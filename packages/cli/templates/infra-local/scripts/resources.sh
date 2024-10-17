#!/bin/sh

# Load environment variables from .env file
if [ -f .env ]; then
  export $(echo $(cat .env | sed 's/#.*//g' | xargs) | envsubst)
fi

echo "======= check if S3 bucket exists ======="
bucket_exists=$(aws --endpoint-url=http://localhost:4566 s3 ls | grep "$S3_BUCKET_NAME" | wc -l)

if [ "$bucket_exists" -eq 0 ]; then
  echo "Bucket $S3_BUCKET_NAME does not exist. Creating it..."
  aws --endpoint-url=http://localhost:4566 s3 mb s3://$S3_BUCKET_NAME
else
  echo "Bucket $S3_BUCKET_NAME already exists."
fi

echo "======= list S3 buckets ======="
aws --endpoint-url=http://localhost:4566 s3 ls
