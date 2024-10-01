#!/bin/bash


lsof -i -P -n | grep LISTEN >> stop.out.txt 2>&1

netstat -ntlp >> stop.out.txt 2>&1

# Stop docker
npm run offline:docker:stop >> stop.out.txt 2>&1
