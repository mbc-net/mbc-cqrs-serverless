![MBC CQRS serverless framework](https://mbc-cqrs-serverless.mbc-net.com/img/mbc-cqrs-serverless.png)

# MBC CQRS Serverless Framework

[![npm version](https://badge.fury.io/js/@mbc-cqrs-serverless%2Fcore.svg)](https://www.npmjs.com/package/@mbc-cqrs-serverless/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Unleash the power of scalable, resilient serverless applications with CQRS on AWS, powered by NestJS and optimized for local development workflows.

## Overview

MBC CQRS Serverless is a comprehensive framework for implementing the Command Query Responsibility Segregation (CQRS) pattern within AWS serverless architectures. Built on top of NestJS, it simplifies the development of highly scalable and decoupled systems that handle complex business logic and high-volume data processing.

## Documentation

Visit https://mbc-cqrs-serverless.mbc-net.com/ to view the full documentation.

## Quick Start

```bash
# Install the CLI globally
npm install -g @mbc-cqrs-serverless/cli

# Create a new project
mbc new my-cqrs-app

# Navigate to project
cd my-cqrs-app

# Install dependencies
npm install

# Start local development
npm run offline:docker   # Terminal 1: Start Docker services
npm run migrate          # Terminal 2: Run database migrations
npm run offline:sls      # Terminal 3: Start serverless offline
```

## Packages

| Package | Description | Version |
|---------|-------------|---------|
| [@mbc-cqrs-serverless/cli](./packages/cli) | CLI tool for project scaffolding | [![npm](https://img.shields.io/npm/v/@mbc-cqrs-serverless/cli.svg)](https://www.npmjs.com/package/@mbc-cqrs-serverless/cli) |
| [@mbc-cqrs-serverless/core](./packages/core) | Core CQRS framework with AWS integrations | [![npm](https://img.shields.io/npm/v/@mbc-cqrs-serverless/core.svg)](https://www.npmjs.com/package/@mbc-cqrs-serverless/core) |
| [@mbc-cqrs-serverless/sequence](./packages/sequence) | Sequence number generation with rotation | [![npm](https://img.shields.io/npm/v/@mbc-cqrs-serverless/sequence.svg)](https://www.npmjs.com/package/@mbc-cqrs-serverless/sequence) |
| [@mbc-cqrs-serverless/task](./packages/task) | Async task processing and queue management | [![npm](https://img.shields.io/npm/v/@mbc-cqrs-serverless/task.svg)](https://www.npmjs.com/package/@mbc-cqrs-serverless/task) |
| [@mbc-cqrs-serverless/master](./packages/master) | Master data and hierarchical settings | [![npm](https://img.shields.io/npm/v/@mbc-cqrs-serverless/master.svg)](https://www.npmjs.com/package/@mbc-cqrs-serverless/master) |
| [@mbc-cqrs-serverless/tenant](./packages/tenant) | Multi-tenancy support | [![npm](https://img.shields.io/npm/v/@mbc-cqrs-serverless/tenant.svg)](https://www.npmjs.com/package/@mbc-cqrs-serverless/tenant) |
| [@mbc-cqrs-serverless/import](./packages/import) | Data import with CSV and REST support | [![npm](https://img.shields.io/npm/v/@mbc-cqrs-serverless/import.svg)](https://www.npmjs.com/package/@mbc-cqrs-serverless/import) |
| [@mbc-cqrs-serverless/ui-setting](./packages/ui-setting) | UI configuration management | [![npm](https://img.shields.io/npm/v/@mbc-cqrs-serverless/ui-setting.svg)](https://www.npmjs.com/package/@mbc-cqrs-serverless/ui-setting) |

## Features

- **CQRS Framework for AWS Serverless**
  - Structured approach for separating commands and queries
  - Integration with AWS services: Cognito, API Gateway, Lambda, DynamoDB, SNS, SQS, Step Functions, RDS

- **Event-Driven Architecture**
  - Event sourcing and messaging for asynchronous communication
  - Loose coupling and independent scaling of components

- **Command and Query Handlers**
  - Abstractions for handling commands and queries
  - Business logic implementation and data persistence

- **Data Consistency**
  - Event sourcing with optimistic locking
  - Data integrity with validation and constraints

- **NestJS Integration**
  - Modular structure with elegant modularity
  - Dependency injection for loose coupling
  - Full TypeScript support
  - Comprehensive testing and error handling

## Local Development

- **Rapid Iteration**: Develop and test locally without cloud deployment
- **Easy Debugging**: Use your favorite tools with full access to application behavior
- **Cost-Effective**: No AWS costs during development

## Installation

### Latest Stable Release
```bash
npm install -g @mbc-cqrs-serverless/cli
```

### Beta Release
```bash
npm install -g @mbc-cqrs-serverless/cli@beta
```

### Specific Version
```bash
npm install -g @mbc-cqrs-serverless/cli@1.0.16
```

## Usage

### Create a New Application

```bash
mbc new my-app
```

### Create with Specific Version

```bash
mbc new my-app@1.0.16
```

## Examples

Check out our [sample repository](https://github.com/mbc-net/mbc-cqrs-serverless-samples) for complete working examples:

- **step-01-setup**: Environment setup
- **step-02-create**: Create operations with CommandService
- **step-03-rds-sync**: DynamoDB to RDS synchronization
- **step-04-read**: Read operations with DataService
- **step-05-search**: Search with Prisma/RDS
- **step-06-update-delete**: Update and soft delete
- **step-07-sequence**: Sequence number generation
- **complete/basic**: Full CRUD implementation
- **complete/with-task**: Async task processing

## Architecture

For detailed architecture documentation, visit our [Architecture Guide](https://mbc-cqrs-serverless.mbc-net.com/docs/introduction).

```
┌─────────────────────────────────────────────────────────────────┐
│                    CQRS Architecture                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐                                               │
│  │   Client     │                                               │
│  └──────────────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐   │
│  │  Controller  │ ──▶  │   Service    │ ──▶  │   Command    │   │
│  │  (REST API)  │      │   Layer      │      │   Service    │   │
│  └──────────────┘      └──────────────┘      └──────────────┘   │
│                               │                     │           │
│                               │                     ▼           │
│                               │              ┌──────────────┐   │
│                               │              │  DynamoDB    │   │
│                               │              │  (Command)   │   │
│                               │              └──────────────┘   │
│                               │                     │           │
│                               │                     ▼ Stream    │
│                               ▼              ┌──────────────┐   │
│                        ┌──────────────┐      │ Step         │   │
│                        │  DataService │      │ Functions    │   │
│                        │  (Read)      │      └──────────────┘   │
│                        └──────────────┘             │           │
│                               │                     ▼           │
│                               ▼              ┌──────────────┐   │
│                        ┌──────────────┐      │  DynamoDB    │   │
│                        │  DynamoDB    │ ◀─── │  (Data)      │   │
│                        │  (Data)      │      └──────────────┘   │
│                        └──────────────┘             │           │
│                                                     ▼           │
│                                              ┌──────────────┐   │
│                        ┌──────────────┐ ◀─── │ DataSync     │   │
│                        │  RDS/MySQL   │      │ Handler      │   │
│                        │  (Query)     │      └──────────────┘   │
│                        └──────────────┘                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Development & Release Process

### Branch Strategy
- `develop`: Development branch for new features and bug fixes
- `beta`: Beta releases for testing and validation
- `main`: Stable production releases

### Versioning
We follow [Semantic Versioning](https://semver.org/):
- `v1.0.16` - Production release (latest)
- `v1.0.16-beta.1` - Beta release
- `v1.0.16-alpha.1` - Alpha release

### Automated Publishing
GitHub Actions automatically publishes packages to npm when tags are pushed:
- Beta tags (`*-beta.*`) → `npm publish --tag beta`
- Release tags (`v*.*.*`) → `npm publish --tag latest`

## How-to Guides

- English: https://mbc-cqrs-serverless.mbc-net.com/docs/build-todo-app
- Japanese: https://www.mbc-net.com/tag/mbc-cqrs-serverless/

## Contributing

We welcome contributions! Please follow our development workflow:

### Development Setup
1. Fork the repository
2. Create a feature branch from `develop`
3. Make your changes
4. Write tests and ensure they pass
5. Submit a pull request to `develop`

### Build and Test
```bash
# Build all packages
npm run build

# Run tests
npm test

# Run linting
npm run lint
```

### Pull Request Guidelines
- Target the `develop` branch
- Include tests for new features
- Follow existing code style
- Update documentation as needed
- Ensure CI checks pass

## References

- [Lerna](https://lerna.js.org/docs/introduction)
- [NPM Workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces)
- [NestJS](https://docs.nestjs.com/)
- [Serverless Framework](https://www.serverless.com/framework/docs)

## License

Copyright &copy; 2024-2025, Murakami Business Consulting, Inc. https://www.mbc-net.com/
This project and sub projects are under the [MIT License](./LICENSE.txt).
