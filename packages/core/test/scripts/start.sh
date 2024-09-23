#!/bin/bash

cp ../../.env.example ../../.env

# Step 1: Run the Docker container
npm run offline:docker -- -d > docker.out.txt 2>&1

LOG_FILE="./docker.out.txt"

# Wait docker started
sleep 15

# start=$(date +%s)
# while true; do

# 	elapsed=$(($(date +%s) - ${start}))
#     echo "${elapsed}"
# 	if [[ ${elapsed} -gt 10 ]]; then
# 		echo "Timeout"
# 		exit 1
# 	fi

#     # Get the last 5 lines from the log file
#     last_lines=$(tail -n 5 "$LOG_FILE")

#     echo "${last_lines}"

#     # Check if all last 5 lines end with "Started"
#     if echo "$last_lines" | grep -q -E 'Started$'; then
#         # If all lines end with "Started", set variable to true
#         result=true
#         break
#     else
#         # Otherwise, set variable to false
#         result=false
#         sleep 5
#     fi

#     # Print the result
#     echo "All last 5 lines end with 'Started': $result"
# done

npm run migrate > migrate.out.txt 2>&1

npm run offline:sls > sls.out.txt 2>&1