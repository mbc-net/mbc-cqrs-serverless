#!/bin/sh

DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
RUN_DIR=${DIR}/.dynamodb
DYNAMODB_LOCAL="http://dynamodb-local.s3-website-us-west-2.amazonaws.com/dynamodb_local_latest.tar.gz"
PORT=8000
ARGS="-inMemory -port ${PORT} -sharedDb"
install_dynamo_db(){
    mkdir -p $1
    curl -L $2 | tar xvz -C $1
}

if [ ! -f ${RUN_DIR}/DynamoDBLocal.jar ]; then
    install_dynamo_db ${RUN_DIR} ${DYNAMODB_LOCAL}
fi
    `which java` -Djava.library.path=${RUN_DIR}/DynamoDBLocal_lib -jar ${RUN_DIR}/DynamoDBLocal.jar ${ARGS}