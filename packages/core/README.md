![MBC CQRS serverless framework](https://mbc-cqrs-serverless.mbc-net.com/img/mbc-cqrs-serverless.png)

# MBC CQRS serverless framework CORE package

## Description

This is the core package of the MBC CQRS Serverless framework. It provides the basic functionality of CQRS.

## Installation

To install `mbc` command, run:

```bash
npm install -g @mbc-cqrs-serverless/cli
```

## Usage

### `mbc new|n [projectName@version]`

There are 3 usages for the new command:

- `mbc new`
    - Creates a new project in the current folder using a default name with the latest framework version.
- `mbc new [projectName]`
    - Creates a new project in the `projectName` folder using the latest framework version.
- `mbc new [projectName@version]`
    - If the specified version exists, the CLI uses that exact version.
    - If the provided version is a prefix, the CLI uses the latest version matching that prefix.
    - If no matching version is found, the CLI logs an error and provides a list of available versions for the user.

To change current directory

```bash
cd [projectName]
```

## Run the Development Server
1. Run npm run build to the build project using development mode.
2. Open in other terminal session and run npm run offline:docker
3. Open in other terminal session and run npm run migrate to migrate RDS and dynamoDB table
4. Finally, run npm run offline:sls to start serverless offline mode.

After the server runs successfully, you can see:

```bash
DEBUG[serverless-offline-sns][adapter]: successfully subscribed queue "http://localhost:9324/101010101010/notification-queue" to topic: "arn:aws:sns:ap-northeast-1:101010101010:MySnsTopic"
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

You can also use several endpoints:

- API gateway: http://localhost:3000
- Offline Lambda Server: http://localhost:4000
- HTTP for lambda: http://localhost:3002
- Step functions: http://localhost:8083
- DynamoDB: http://localhost:8000
- DynamoDB admin: http://localhost:8001
- SNS: http://localhost:4002
- SQS: http://localhost:9324
- SQS admin: http://localhost:9325
- Localstack: http://localhost:4566
- AppSync: http://localhost:4001
- Cognito: http://localhost:9229
- EventBridge: http://localhost:4010
- Simple Email Service: http://localhost:8005
- Run `npx prisma studio` to open studio web: http://localhost:5000


## Documentation

Visit https://mbc-cqrs-serverless.mbc-net.com/ to view the full documentation.

## License

Copyright &copy; 2024, Murakami Business Consulting, Inc. https://www.mbc-net.com/  
This project and sub projects are under the MIT License.
