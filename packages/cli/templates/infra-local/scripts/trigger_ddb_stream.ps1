# Set AWS environment variables
$env:AWS_DEFAULT_REGION = "ap-northeast-1"
$env:AWS_ACCOUNT_ID = "101010101010"
$env:AWS_ACCESS_KEY_ID = "local"
$env:AWS_SECRET_ACCESS_KEY = "local"

# Load environment variables from .env file
Get-Content .env | ForEach-Object {
    if ($_ -match "^\s*#") {
        return
    }
    if ($_ -match "^\s*(\w+)\s*=\s*(.*)\s*$") {
        $name = $matches[1]
        $value = $matches[2]
        $value = $value -replace '\s*#.*', ''
        [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

# Build table name prefix from environment variables
# Default: NODE_ENV=local, APP_NAME from .env
$tablePrefix = if ($env:NODE_ENV) { $env:NODE_ENV } else { "local" }
$tablePrefix = "$tablePrefix-$env:APP_NAME"

# Get ports from environment variables with defaults
$dynamodbPort = if ($env:LOCAL_DYNAMODB_PORT) { $env:LOCAL_DYNAMODB_PORT } else { "8000" }
$httpPort = if ($env:LOCAL_HTTP_PORT) { $env:LOCAL_HTTP_PORT } else { "3000" }

$endpoint = "http://localhost:$dynamodbPort"

Write-Host "Using configuration:"
Write-Host "  TABLE_PREFIX: $tablePrefix"
Write-Host "  DynamoDB endpoint: $endpoint"
Write-Host "  Serverless HTTP port: $httpPort"

Write-Host "Read table name"

# Read table names from JSON file
$tables = (Get-Content .\prisma\dynamodbs\cqrs.json | ConvertFrom-Json)

# Check table health
$start = Get-Date
foreach ($table in $tables) {
    while ($true) {
        $elapsed = (New-TimeSpan -Start $start).TotalSeconds
        if ($elapsed -gt 10) {
            Write-Host "Timeout"
            exit 1
        }

        Write-Host "Check health table $tablePrefix-$table-command"
        $status = aws --endpoint $endpoint dynamodb describe-table --table-name "$tablePrefix-$table-command" --query "Table.TableStatus"

        Write-Host "Table status: $status"
        if ($status -eq '"ACTIVE"') {
            Write-Host "Table $table is ACTIVE"
            break
        } else {
            Write-Host "Table $table is not ACTIVE"
            Start-Sleep -Seconds 1
        }
    }
}

# Check the health of 'tasks' table
$start = Get-Date
while ($true) {
    $elapsed = (New-TimeSpan -Start $start).TotalSeconds
    if ($elapsed -gt 10) {
        Write-Host "Timeout"
        exit 1
    }

    Write-Host "Check health table tasks"
    $status = aws --endpoint $endpoint dynamodb describe-table --table-name "$tablePrefix-tasks" --query "Table.TableStatus"

    Write-Host "Table status: $status"
    if ($status -eq '"ACTIVE"') {
        Write-Host "Table tasks is ACTIVE"
        break
    } else {
        Write-Host "Table tasks is not ACTIVE"
        Start-Sleep -Seconds 1
    }
}

# Wait for serverless to start
$start = Get-Date
while ($true) {
    $elapsed = (New-TimeSpan -Start $start).TotalSeconds
    if ($elapsed -gt 10) {
        Write-Host "Timeout"
        exit 1
    }

    Write-Host "Check health serverless"
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$httpPort" -UseBasicParsing -ErrorAction Stop
        $status = $response.StatusCode
    } catch {
        if ($_.Exception.Response -ne $null) {
            $status = $_.Exception.Response.StatusCode.Value__
        } else {
            $status = 0  # Assign 0 or another value if there's no HTTP response (e.g., connection failure)
        }
    }

    Write-Host "Serverless status: $status"

    if ($status -eq 200) {
        Write-Host "Serverless is ACTIVE"
        break
    } else {
        Write-Host "Serverless is not ACTIVE"
        Start-Sleep -Seconds 1
    }
}


# Register Step Functions state machines before triggering streams
$sfnPort = if ($env:LOCAL_SFN_PORT) { $env:LOCAL_SFN_PORT } else { "8083" }
$sfnEndpoint = "http://localhost:$sfnPort"

# Wait for Step Functions Local to accept connections before registering, so a
# not-yet-ready endpoint (the exact race this block fixes) does not cause silent
# registration failures.
$sfnStart = Get-Date
while ($true) {
    $sfnElapsed = ((Get-Date) - $sfnStart).TotalSeconds
    if ($sfnElapsed -gt 30) {
        Write-Host "Timeout waiting for Step Functions Local at $sfnEndpoint"
        exit 1
    }
    Write-Host "Check health Step Functions Local"
    aws stepfunctions list-state-machines --endpoint-url $sfnEndpoint --region ap-northeast-1 *> $null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Step Functions Local is ACTIVE"
        break
    }
    Write-Host "Step Functions Local is not ACTIVE"
    Start-Sleep -Seconds 1
}

Write-Host "Registering Step Functions state machines..."

# Extract state machine names and definitions from serverless.yml using Node.js
$nodeScript = @"
const fs = require('fs');
const yaml = require('js-yaml');
let content = fs.readFileSync('./infra-local/serverless.yml', 'utf8');
content = content.replace(/\`$\{[^}]+\}/g, 'PLACEHOLDER');
const data = yaml.load(content);
const sms = (data.stepFunctions || {}).stateMachines || {};
const result = [];
for (const [key, sm] of Object.entries(sms)) {
  result.push({ name: sm.name || key, definition: JSON.stringify(sm.definition) });
}
console.log(JSON.stringify(result));
"@

$stateMachines = node -e $nodeScript | ConvertFrom-Json

foreach ($sm in $stateMachines) {
    $smName = $sm.name
    $smDefinition = $sm.definition
    Write-Host "Checking state machine: $smName"
    # stderr discarded and success decided by $LASTEXITCODE (not string-matching
    # the output) so a CLI error is not mistaken for an existing state machine.
    $existing = aws stepfunctions list-state-machines `
        --endpoint-url $sfnEndpoint `
        --region ap-northeast-1 `
        --query "stateMachines[?name=='$smName'].name" `
        --output text 2>$null

    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($existing)) {
        Write-Host "Creating state machine: $smName"
        # Escape embedded double quotes before passing the JSON definition to
        # aws.exe (same pattern as the put-item call below); native-command
        # failures are detected via $LASTEXITCODE, not try/catch, which does not
        # trigger on non-zero exit of external executables.
        $escapedDefinition = $smDefinition -replace '"', '\"'
        aws stepfunctions create-state-machine `
            --endpoint-url $sfnEndpoint `
            --region ap-northeast-1 `
            --name $smName `
            --role-arn "arn:aws:iam::101010101010:role/DummyRole" `
            --definition $escapedDefinition 2>&1 | Out-Host
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Created $smName"
        } else {
            Write-Host "Failed to create $smName"
        }
    } else {
        Write-Host "State machine $smName already exists"
    }
}

# Trigger command stream
$timestamp = [math]::Round((Get-Date).Subtract((Get-Date "01/01/1970")).TotalSeconds)
foreach ($table in $tables) {
    Write-Host "Send a command to trigger command stream $table"
    $item = @{
        pk = @{ S = "test" }
        sk = @{ S = "$timestamp" }
    }

    # Convert the item to a JSON string with double quotes
    $jsonItem = $item | ConvertTo-Json -Compress

    $jsonItemString = [string]$jsonItem

    $escapedJsonItemString = $jsonItemString -replace '"', '\"'

    Write-Host "Send a item to trigger command $table"

    aws dynamodb put-item --endpoint $endpoint --table-name "$tablePrefix-$table-command" --item $escapedJsonItemString
}

# Trigger tasks stream
Write-Host  "Send a command to trigger command stream tasks"
$command = @"
aws dynamodb put-item --endpoint $endpoint --table-name "$tablePrefix-tasks" --item '{\"input\":{\"M\":{\"action\":{\"S\":\"trigger\"}}},\"sk\":{\"S\":\"$timestamp\"},\"pk\":{\"S\":\"test\"}}'
"@
Invoke-Expression $command
