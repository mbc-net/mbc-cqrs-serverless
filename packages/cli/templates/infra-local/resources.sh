#!/bin/sh

if [ -f .env ]; then
  export $(echo $(cat .env | sed 's/#.*//g'| xargs) | envsubst)
fi

echo "======= create S3 buckets ======="
aws --endpoint-url=http://localhost:4566 s3 mb s3://$S3_BUCKET_NAME

echo "======= list S3 buckets ======="
aws --endpoint-url=http://localhost:4566 s3 ls