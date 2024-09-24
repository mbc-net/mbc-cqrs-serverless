#!/bin/bash

cp ../../.env.example ../../.env

rm *.out.txt

echo "Run dynamodb local" >> start.out.txt 2>&1

bash ./run_dynamodb_local.sh > dynamodb_local.out.txt 2>&1 &

# Step 1: Run the Docker container
npm run offline:docker -- -d > docker.out.txt 2>&1

LOG_FILE="./docker.out.txt"
DYNAMO_PORT=8000

start=$(date +%s)
while true; do

	elapsed=$(($(date +%s) - ${start}))
    echo "${elapsed}"
	if [[ ${elapsed} -gt 600 ]]; then
		echo "Timeout" >> start.out.txt 2>&1
		exit 1
	fi

    # Get the last 5 lines from the log file
    last_lines=$(tail -n 3 "$LOG_FILE")

    echo "${last_lines}" >> start.out.txt 2>&1

    # Check if all last 5 lines end with "Started"
    if echo "$last_lines" | grep -q -E 'Started$|Running$'; then
        break
    else
        sleep 5
    fi

    # Print the result
    echo "All last 3 lines end with 'Started|Running': $result" >> start.out.txt 2>&1
done

sleep 15

# Check if DynamoLocal is running or not.
start=$(date +%s)
while true; do

	elapsed=$(($(date +%s) - ${start}))
    echo "${elapsed}"
	if [[ ${elapsed} -gt 60 ]]; then
		echo "Timeout dynamodb" >> start.out.txt 2>&1
		exit 1
	fi

    nc -zv localhost $DYNAMO_PORT > dynamo.out.txt 2>&1

    if nc -z localhost $DYNAMO_PORT; then
        echo "Port $DYNAMO_PORT is open." >> start.out.txt 2>&1
        break
    else
        echo "Port $DYNAMO_PORT is not open." >> start.out.txt 2>&1
        sleep 5
    fi

done


echo "Run migrate" >> start.out.txt 2>&1

npm run migrate > migrate.out.txt 2>&1

echo "Run serverless offline" >> start.out.txt 2>&1

npm run offline:sls > sls.out.txt 2>&1