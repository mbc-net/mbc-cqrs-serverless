#!/bin/bash

cp ../../.env.example ../../.env

rm *.out.txt

# Step 1: Run the Docker container
npm run offline:docker -- -d > docker.out.txt 2>&1

LOG_FILE="./docker.out.txt"
DYNAMO_PORT=8000

start=$(date +%s)
while true; do

	elapsed=$(($(date +%s) - ${start}))
    echo "${elapsed}"
	if [[ ${elapsed} -gt 600 ]]; then
		echo "Timeout"
		exit 1
	fi

    # Get the last 5 lines from the log file
    last_lines=$(tail -n 4 "$LOG_FILE")

    echo "${last_lines}"

    # Check if all last 5 lines end with "Started"
    if echo "$last_lines" | grep -q -E 'Started$|Running$'; then
        break
    else
        sleep 5
    fi

    # Print the result
    echo "All last 4 lines end with 'Started|Running': $result"
done

sleep 15

# Check if DynamoLocal is running or not.
start=$(date +%s)
while true; do

	elapsed=$(($(date +%s) - ${start}))
    echo "${elapsed}"
	if [[ ${elapsed} -gt 8 ]]; then
		echo "Timeout dynamodb"
		exit 1
	fi

    nc -zv localhost $DYNAMO_PORT > dynamo.out.txt 2>&1

    if nc -z localhost $DYNAMO_PORT; then
        echo "Port $DYNAMO_PORT is open."
        break
    else
        echo "Port $DYNAMO_PORT is not open."
        sleep 0.01
    fi

done


echo "Run migrate"

npm run migrate > migrate.out.txt 2>&1

echo "Run serverless offline"

npm run offline:sls > sls.out.txt 2>&1