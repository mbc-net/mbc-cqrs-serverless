#!/bin/bash

export AWS_DEFAULT_REGION=ap-northeast-1
export AWS_ACCOUNT_ID=101010101010
export AWS_ACCESS_KEY_ID=local
export AWS_SECRET_ACCESS_KEY=local

# Load environment variables from .env file
source .env

# Build table name prefix from environment variables
# Default: NODE_ENV=local, APP_NAME from .env
TABLE_PREFIX="${NODE_ENV:-local}-${APP_NAME}"

# Get ports from environment variables with defaults
DYNAMODB_PORT="${LOCAL_DYNAMODB_PORT:-8000}"
HTTP_PORT="${LOCAL_HTTP_PORT:-3000}"

endpoint="http://localhost:${DYNAMODB_PORT}"

echo "Using configuration:"
echo "  TABLE_PREFIX: ${TABLE_PREFIX}"
echo "  DynamoDB endpoint: ${endpoint}"
echo "  Serverless HTTP port: ${HTTP_PORT}"

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
		status=$(aws --endpoint=${endpoint} dynamodb describe-table --table-name ${TABLE_PREFIX}-${table}-command --query 'Table.TableStatus')
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

start=$(date +%s)
while true; do
	elapsed=$(($(date +%s) - ${start}))
	if [[ ${elapsed} -gt 10 ]]; then
		echo "Timeout"
		exit 1
	fi

	echo "Check health table tasks"
	status=$(aws --endpoint=${endpoint} dynamodb describe-table --table-name ${TABLE_PREFIX}-tasks --query 'Table.TableStatus')
	echo "Table status: ${status}"
	if [[ "${status}" == "\"ACTIVE\"" ]]; then
		echo "Table tasks is ACTIVE"
		break
	else
		echo "Table tasks is not ACTIVE"
		sleep 1
	fi
done

# Wait serverless start (cold start compiles TS and initializes many plugins,
# so allow a generous timeout to avoid failing the local startup flow)
start=$(date +%s)
while true; do

	elapsed=$(($(date +%s) - ${start}))
	if [[ ${elapsed} -gt 100 ]]; then
		echo "Timeout"
		exit 1
	fi

	echo "Check health serverless"
	status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${HTTP_PORT})
	echo "Serverless status: ${status}"
	if [[ "${status}" == "200" ]]; then
		echo "Serverless is ACTIVE"
		break
	else
		echo "Serverless is not ACTIVE"
		sleep 1
	fi
done

# Register Step Functions state machines before triggering streams
SFN_PORT="${LOCAL_SFN_PORT:-8083}"
SFN_ENDPOINT="http://localhost:${SFN_PORT}"

# Wait for Step Functions Local to accept connections before registering, so a
# not-yet-ready endpoint (the exact race this block fixes) does not cause silent
# registration failures.
start=$(date +%s)
while true; do
	elapsed=$(($(date +%s) - ${start}))
	if [[ ${elapsed} -gt 30 ]]; then
		echo "Timeout waiting for Step Functions Local at ${SFN_ENDPOINT}"
		exit 1
	fi
	echo "Check health Step Functions Local"
	if aws stepfunctions list-state-machines \
		--endpoint-url ${SFN_ENDPOINT} \
		--region ap-northeast-1 >/dev/null 2>&1; then
		echo "Step Functions Local is ACTIVE"
		break
	fi
	echo "Step Functions Local is not ACTIVE"
	sleep 1
done

echo "Registering Step Functions state machines..."

# Extract state machine names and definitions from serverless.yml using Node.js.
# Fail fast if extraction fails (e.g. js-yaml missing) so registration is not
# silently skipped and later surfaced only as repeated runtime warnings.
sm_data=$(node -e "
const fs = require('fs');
const yaml = require('js-yaml');
let content = fs.readFileSync('./infra-local/serverless.yml', 'utf8');
// Replace Serverless Framework variable syntax to avoid YAML parse errors
content = content.replace(/\\\$\{[^}]+\}/g, 'PLACEHOLDER');
const data = yaml.load(content);
const sms = (data.stepFunctions || {}).stateMachines || {};
for (const [key, sm] of Object.entries(sms)) {
  const name = sm.name || key;
  const definition = JSON.stringify(sm.definition);
  console.log(name + '\t' + definition);
}
")
if [ $? -ne 0 ]; then
	echo "Failed to extract state machines from serverless.yml (is js-yaml installed?)"
	exit 1
fi

# A here-string (not a pipe) keeps the loop in the current shell so an "exit"
# on a failed create actually aborts the script before triggering streams.
while IFS=$'\t' read -r sm_name sm_definition; do
	[ -z "${sm_name}" ] && continue
	echo "Checking state machine: ${sm_name}"
	# stderr is discarded (not captured) so a connection error is not mistaken
	# for an existing state machine; readiness is already ensured above.
	existing=$(aws stepfunctions list-state-machines \
		--endpoint-url ${SFN_ENDPOINT} \
		--region ap-northeast-1 \
		--query "stateMachines[?name=='${sm_name}'].name" \
		--output text 2>/dev/null)
	if [ -z "${existing}" ]; then
		echo "Creating state machine: ${sm_name}"
		# The serverless-step-functions-local plugin also auto-registers state
		# machines on offline:start:init; this block is a fallback for the race
		# where Step Functions Local starts after that hook runs. A benign
		# "already exists" is treated as success; only a real failure aborts.
		if create_out=$(aws stepfunctions create-state-machine \
			--endpoint-url ${SFN_ENDPOINT} \
			--region ap-northeast-1 \
			--name "${sm_name}" \
			--role-arn "arn:aws:iam::101010101010:role/DummyRole" \
			--definition "${sm_definition}" 2>&1); then
			echo "Created ${sm_name}"
		elif echo "${create_out}" | grep -qi "already exists\|StateMachineAlreadyExists"; then
			echo "State machine ${sm_name} already exists"
		else
			echo "Failed to create ${sm_name}: ${create_out}"
			exit 1
		fi
	else
		echo "State machine ${sm_name} already exists"
	fi
done <<< "${sm_data}"

# Trigger command stream
timestamp=$(date +%s)
for table in "${tables[@]}"; do
	echo "Send a command to trigger command stream ${table}"
	aws --endpoint=${endpoint} dynamodb put-item --table-name ${TABLE_PREFIX}-${table}-command --item "{\"pk\": {\"S\": \"test\" }, \"sk\": { \"S\": \"${timestamp}\" }}"
done

echo "Send a command to trigger command stream tasks"
aws --endpoint=${endpoint} dynamodb put-item --table-name ${TABLE_PREFIX}-tasks --item "{\"input\":{\"M\":{\"action\":{\"S\":\"trigger\"}}},\"sk\":{\"S\":\"${timestamp}\"},\"pk\":{\"S\":\"test\"}}"
