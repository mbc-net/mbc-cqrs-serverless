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

# Get S3 port from environment variable with default
$s3Port = if ($env:LOCAL_S3_PORT) { $env:LOCAL_S3_PORT } else { "4566" }

Write-Host "======= check if S3 bucket exists ======="
$bucketExists = aws --endpoint-url=http://localhost:$s3Port s3 ls | Select-String $env:S3_BUCKET_NAME

if (-not $bucketExists) {
    Write-Host "Bucket $env:S3_BUCKET_NAME does not exist. Creating it..."
    aws --endpoint-url=http://localhost:$s3Port s3 mb "s3://$env:S3_BUCKET_NAME"
} else {
    Write-Host "Bucket $env:S3_BUCKET_NAME already exists."
}

# Presigned upload/view URLs (see DirectoryFileService) are fetched by the
# browser, so the bucket needs a CORS rule or the preflight fails with 403 and
# the real request is never sent. The previous LocalStack service granted this
# implicitly through EXTRA_CORS_ALLOWED_ORIGINS=*; Floci has no such switch.
# Production configures CORS in the CDK stack - this is the local equivalent.
# Applied unconditionally so buckets created before this script gained the rule
# are brought up to date too.
Write-Host "======= configure S3 bucket CORS ======="
$corsConfiguration = @'
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"]
    }
  ]
}
'@

# Passed as file:// rather than inline: PowerShell mangles embedded quotes on
# the way to the AWS CLI.
$corsFile = Join-Path ([System.IO.Path]::GetTempPath()) "mbc-s3-cors.json"
Set-Content -Path $corsFile -Value $corsConfiguration -Encoding utf8
try {
    aws --endpoint-url=http://localhost:$s3Port s3api put-bucket-cors --bucket $env:S3_BUCKET_NAME --cors-configuration "file://$corsFile"
} finally {
    Remove-Item $corsFile -ErrorAction SilentlyContinue
}

Write-Host "======= list S3 buckets ======="
aws --endpoint-url=http://localhost:$s3Port s3 ls