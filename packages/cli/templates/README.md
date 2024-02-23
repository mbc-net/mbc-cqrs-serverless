## Description

CQRS framework based on [Nest](https://github.com/nestjs/nest).

TechStack:

- [Nest](https://github/nestjs/nest)
- TypeScript
- AWS Serverless

  - API GW
  - Lambda
  - Step Functions
  - EventBridge
  - DynamoDB

- RDS - PostgreSQL
- Serverless fw && Localstack for local development

## Prepare

- [Nodejs](https://nodejs.org/en/download)
- [JQ cli](https://jqlang.github.io/jq/download/)
- [AWS cli](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [Docker](https://docs.docker.com/engine/install/)

## Installation

```bash
$ cp .env.local .env
$ npm install
```

## Running the app

```bash
# development build
$ npm run build

# docker, open in other terminal session
$ npm run offline:docker

# create resources such as S3 buckets
$ sh infra-local/resources.sh

# migrate tables, open in other terminal session
$ npm run migrate

# copy dynamodb stream arn to `.env` file
      # LOCAL_DDB_MASTER_STREAM=arn:aws:dynamodb:ddblocal:000000000000:table/local-demo-master-command/stream/2024-01-02T03:07:49.349

# serverless, open in other terminal session
$ npm run offline:sls
```

- After successfully running

```bash
DEBUG[serverless-offline-sns][adapter]: successfully subscribed queue "http://localhost:9324/101010101010/notification-queue" to topic: "arn:aws:sns:ap-northeast-1:101010101010:CqrsSnsTopic"
Offline Lambda Server listening on http://localhost:4000
serverless-offline-aws-eventbridge :: Plugin ready
serverless-offline-aws-eventbridge :: Mock server running at port: 4010
Starting Offline SQS at stage dev (ap-northeast-1)
Starting Offline Dynamodb Streams at stage dev (ap-northeast-1)

Starting Offline at stage dev (ap-northeast-1)

Offline [http for lambda] listening on http://localhost:3002
Function names exposed for local invocation by aws-sdk:
           * main: serverless-example-dev-main
Configuring JWT Authorization: ANY /{proxy+}

   ┌────────────────────────────────────────────────────────────────────────┐
   │                                                                        │
   │   ANY | http://localhost:3000/api/public                               │
   │   POST | http://localhost:3000/2015-03-31/functions/main/invocations   │
   │   ANY | http://localhost:3000/swagger-ui/{proxy*}                      │
   │   POST | http://localhost:3000/2015-03-31/functions/main/invocations   │
   │   ANY | http://localhost:3000/{proxy*}                                 │
   │   POST | http://localhost:3000/2015-03-31/functions/main/invocations   │
   │                                                                        │
   └────────────────────────────────────────────────────────────────────────┘

Server ready: http://localhost:3000 🚀

```

## Helpers

```bash
# prisma command
$ npx prisma
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Before use Keycloak

Go to http://localhost:8180/admin/master/console/#/master/clients

- create a new client

  - Client type: `OpenID Connect`
  - Client ID: `hello-world`
  - Valid redirect URIs: `*`
  - Web origins: `*`

- go to Client scopes tab, then add new mapper

  - Mapper type: `Audience`
  - Name: `hello-world`
  - Included Client Audience: `hello-world`
  - Add to access token: `true`

- Ref: https://www.keycloak.org/getting-started/getting-started-docker

### Update `frontend/aws-export.js`

```bash
$ cp frontend/aws-export.local.js frontend/src/aws-export.js
```

## Step function execution

```bash
$ aws stepfunctions --endpoint-url http://localhost:8083 start-execution --state-machine-arn arn:aws:states:ap-northeast-1:101010101010:stateMachine:foo1
```

## Endpoints

- api gw: http://localhost:3000
- lambda: http://localhost:4000
- lambda http: http://localhost:3002
- step functions: http://localhost:8083
- dynamodb: http://localhost:8000
- dynamodb admin: http://localhost:8001
- sns: http://localhost:4002
- sqs: http://localhost:9324
- sqs admin: http://localhost:9325
- localstack: http://localhost:4566
  - S3
- appsync: http://localhost:4001
- cognito: http://localhost:9229
- eventbridge: http://localhost:4010
- ses email: http://localhost:8005
- prisma studio: http://localhost:5000
  - run `npx prisma studio` to open studio web

## Nestjs Debug mode

Run the following cmd to open nestjs debug mode

```
$ npm run start:repl
```

- Ref: https://docs.nestjs.com/recipes/repl
