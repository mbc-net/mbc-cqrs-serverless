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

Write-Host "======= check if S3 bucket exists ======="
$bucketExists = aws --endpoint-url=http://localhost:4566 s3 ls | Select-String $env:S3_BUCKET_NAME

if (-not $bucketExists) {
    Write-Host "Bucket $env:S3_BUCKET_NAME does not exist. Creating it..."
    aws --endpoint-url=http://localhost:4566 s3 mb "s3://$env:S3_BUCKET_NAME"
} else {
    Write-Host "Bucket $env:S3_BUCKET_NAME already exists."
}

Write-Host "======= list S3 buckets ======="
aws --endpoint-url=http://localhost:4566 s3 ls