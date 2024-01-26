#!/bin/bash

export AWS_DEFAULT_REGION=ap-northeast-1
export AWS_ACCOUNT_ID=101010101010
export AWS_ACCESS_KEY_ID=local
export AWS_SECRET_ACCESS_KEY=local

endpoint='http://localhost:8000'

source .env

echo "Read table name"
declare -a tables
while IFS= read -r line; do
	tables+=("$line")
done < <(jq -r '.[]' ./prisma/dynamodbs/cqrs.json)

# Check table health
start=$(date +%s)
for table in "${tables[@]}"; do
	while true; do

		elapsed=$(($(date +%s) - ${start}))
		if [[ ${elapsed} -gt 10 ]]; then
			echo "Timeout"
			exit 1
		fi

		echo "Check health table ${table}"
		status=$(aws --endpoint=${endpoint} dynamodb describe-table --table-name local-${APP_NAME}-${table}-command --query 'Table.TableStatus')
		echo "Table status: ${status}"
		if [[ "${status}" == "\"ACTIVE\"" ]]; then
			echo "Table ${table} is ACTIVE"
			break
		else
			echo "Table ${table} is not ACTIVE"
			sleep 1
		fi
	done
done

# Wait serverless start
start=$(date +%s)
while true; do

	elapsed=$(($(date +%s) - ${start}))
	if [[ ${elapsed} -gt 10 ]]; then
		echo "Timeout"
		exit 1
	fi

	echo "Check health serverless"
	status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
	echo "Serverless status: ${status}"
	if [[ "${status}" == "200" ]]; then
		echo "Serverless is ACTIVE"
		break
	else
		echo "Serverless is not ACTIVE"
		sleep 1
	fi
done

# Trigger command stream
timestamp=$(date +%s)
for table in "${tables[@]}"; do
	echo "Send a command to trigger command stream ${table}"
	aws --endpoint=${endpoint} dynamodb put-item --table-name local-${APP_NAME}-${table}-command --item "{\"pk\": {\"S\": \"test\" }, \"sk\": { \"S\": \"${timestamp}\" }}"
done
