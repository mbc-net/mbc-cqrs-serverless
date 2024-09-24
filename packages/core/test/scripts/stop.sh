#!/bin/bash

# Stop dynamodb local
PID=$(lsof -ti :8000)

if [ -n "$PID" ]; then
  kill -9 "$PID"
  echo "Process running on port 8000 with PID $PID has been killed."
else
  echo "No process is running on port 8000."
fi

# Stop 
PID=$(lsof -ti :4002)

if [ -n "$PID" ]; then
  kill -9 "$PID"
  echo "Process running on port 4002 with PID $PID has been killed."
else
  echo "No process is running on port 4002."
fi

# Stop docker
npm run offline:docker:stop
