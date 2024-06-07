# MBC CQRS serverless framework

Unleash the power of scalable, resilient serverless applications with CQRS on AWS, the magic of NestJS and the convenience of local development workflows! ✨

## Overview

This package provides core functionalities for implementing the Command Query Responsibility Segregation (CQRS) pattern within AWS serverless architectures, powered by the incredible NestJS framework. It simplifies the development of highly scalable and decoupled systems that can handle complex business logic and high-volume data processing.

## Features

- **CQRS framework for AWS serverless**:
  - Structured approach for separating commands and queries
  - Integration with AWS services like Cognito, API Gateway, Lambda, DynamoDB, SNS, and SQS, StepFuction, RDS ⚡
- **Event-driven architecture**:
  - Leverages event sourcing and messaging for asynchronous communication
  - Enables loose coupling and independent scaling of components
- **Command and query handlers**:
  - Provides abstractions for handling commands and queries
  - Facilitates business logic implementation and data persistence
- **Asynchronous communication**:
  - Supports event publishing and message passing for inter-component communication
- **Data consistency and integrity**:
  - Ensures data consistency through event sourcing and optimistic locking
  - Enforces data integrity with validation and constraints
- **Experience a harmonious symphony of CQRS and NestJS:**
  - **Modular structure**: Organize CQRS components with NestJS's elegant modularity
  - **Dependency injection**: Simplify dependency management and embrace loose coupling with NestJS's DI system
  - **TypeScript support**: Write type-safe, crystal-clear code with built-in TypeScript
  - **Testing and error handling**: Build confidence with comprehensive testing and robust error handling, courtesy of NestJS
  - **Ecosystem compatibility**: Tap into the vast NestJS universe of modules and libraries to expand possibilities

## Local Development Symphony

- **Embrace agility**: Experience rapid iteration and experimentation in a local environment, without the need for constant cloud deployment.
- **Debugging bliss**: Debug with ease using your favorite tools and techniques, gaining deeper insights into your application's behavior.
- **Cost-effective exploration**: Explore and refine your CQRS implementation locally, without incurring AWS costs during development.

## Installation

```bash
$ npm i -g @mbc-cqrs-severless/cli
```

## Usage

- Create a new application

```
$ mbc new YOUR_PROJECT_NAME
```

## Examples

- [Check here](./examples/)

## Architecture

- TODO

## How to guide

- TODO

## Contributing

- Add new packages by

```bash
$ npm init --scope mbc-cqrs-severless -w ./packages/{PACKAGE_NAME}
```

- Build packages

```bash
$ npm run build
```

- Publish packages

```bash
$ npm run release
```

## References

- Lerna: https://lerna.js.org/docs/introduction
- NPM workspace: https://docs.npmjs.com/cli/v7/using-npm/workspaces
- Nestjs: https://docs.nestjs.com/
- Serverless framework: https://www.serverless.com/framework/docs
