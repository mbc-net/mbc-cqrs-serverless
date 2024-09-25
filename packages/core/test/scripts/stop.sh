#!/bin/bash


lsof -i -P -n | grep LISTEN >> stop.out.txt 2>&1

netstat -ntlp >> stop.out.txt 2>&1

PID=$(lsof -ti :3000)
echo "Process running on port 3000 with PID $PID"  >> stop.out.txt 2>&1

# Stop dynamodb local
PID=$(lsof -ti :8000)

if [ -n "$PID" ]; then
  kill -9 $PID
  echo "Process running on port 8000 with PID $PID has been killed." >> stop.out.txt 2>&1
else
  echo "No process is running on port 8000." >> stop.out.txt 2>&1
fi

# Stop 
PID=$(lsof -ti :4002)

if [ -n "$PID" ]; then
  kill -9 $PID
  echo "Process running on port 4002 with PID $PID has been killed." >> stop.out.txt 2>&1
else
  echo "No process is running on port 4002." >> stop.out.txt 2>&1
fi

# Stop docker
npm run offline:docker:stop >> stop.out.txt 2>&1
