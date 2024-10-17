# Set AWS environment variables
$env:AWS_DEFAULT_REGION = "ap-northeast-1"
$env:AWS_ACCOUNT_ID = "101010101010"
$env:AWS_ACCESS_KEY_ID = "local"
$env:AWS_SECRET_ACCESS_KEY = "local"

$endpoint = "http://localhost:8000"

# Load environment variables from .env file (assuming you have a utility to load it)
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

        Write-Host "Check health table local-$env:APP_NAME-$table-command"
        Write-Host "local-$env:APP_NAME-$table-command"
        $status = aws --endpoint $endpoint dynamodb describe-table --table-name "local-$env:APP_NAME-$table-command" --query "Table.TableStatus"

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
    $status = aws --endpoint $endpoint dynamodb describe-table --table-name "local-$env:APP_NAME-tasks" --query "Table.TableStatus"

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
    if ($elapsed -gt 100) {
        Write-Host "Timeout"
        exit 1
    }

    Write-Host "Check health serverless"
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -ErrorAction Stop
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

    aws dynamodb put-item --endpoint http://localhost:8000 --table-name "local-$env:APP_NAME-$table-command" --item $escapedJsonItemString
}

# Trigger asks stream
Write-Host  "Send a command to trigger command stream tasks"
$command = @"
aws dynamodb put-item --endpoint http://localhost:8000 --table-name "local-$env:APP_NAME-tasks" --item '{\"input\":{\"M\":{}},\"sk\":{\"S\":\"$timestamp\"},\"pk\":{\"S\":\"test\"}}'
"@
Invoke-Expression $command
