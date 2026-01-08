![MBC CQRS serverless framework](https://mbc-cqrs-serverless.mbc-net.com/img/mbc-cqrs-serverless.png)

<div align="center">

# MBC CQRS Serverless Framework

**Build production-ready serverless applications on AWS in minutes, not months.**

[![npm version](https://badge.fury.io/js/@mbc-cqrs-serverless%2Fcore.svg)](https://www.npmjs.com/package/@mbc-cqrs-serverless/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-red.svg)](https://nestjs.com/)

[Documentation](https://mbc-cqrs-serverless.mbc-net.com/) | [Getting Started](#quick-start) | [Examples](https://github.com/mbc-net/mbc-cqrs-serverless-samples) | [API Reference](https://mbc-cqrs-serverless.mbc-net.com/docs/command-service)

</div>

---

## Why MBC CQRS Serverless?

Building enterprise-grade serverless applications on AWS is hard. You need to handle:
- Event sourcing and CQRS patterns
- Multi-tenancy and data isolation
- DynamoDB to RDS synchronization
- Sequence number generation
- Async task processing
- ...and much more

**MBC CQRS Serverless provides all of this out of the box**, so you can focus on your business logic.

### Key Benefits

| Feature | What You Get |
|---------|--------------|
| **Zero to API in 5 minutes** | CLI generates complete project structure with best practices |
| **Built-in Multi-tenancy** | Data isolation, tenant settings, and RBAC out of the box |
| **Event Sourcing** | Full audit trail with DynamoDB Streams and automatic RDS sync |
| **Local Development** | Complete offline mode with Docker - no AWS costs during development |
| **Production Ready** | Battle-tested in enterprise SaaS applications |

---

## Quick Start

```bash
# Install CLI
npm install -g @mbc-cqrs-serverless/cli

# Create new project
mbc new my-saas-app

# Start development
cd my-saas-app
npm install
npm run offline:docker   # Start local AWS services
npm run migrate          # Run database migrations
npm run offline:sls      # Start API server
```

**That's it!** Your API is running at `http://localhost:4000`

---

## See It in Action

### Create a CRUD endpoint in 30 lines:

```typescript
// todo.controller.ts
@Controller('api/todo')
export class TodoController {
  constructor(
    private readonly commandService: CommandService,
    private readonly dataService: DataService,
  ) {}

  @Post()
  async create(@Body() dto: CreateTodoDto, @IInvoke() invokeContext: IInvoke) {
    const command = new TodoCommandDto({
      pk: dto.pk,
      sk: dto.sk,
      tenantCode: invokeContext.tenantCode,
      name: dto.name,
      attributes: { description: dto.description },
    });
    return this.commandService.publishSync(command, { invokeContext });
  }

  @Get(':pk/:sk')
  async findOne(@Param('pk') pk: string, @Param('sk') sk: string) {
    return this.dataService.getItem({ pk, sk });
  }
}
```

**What happens automatically:**
- Command is validated and persisted to DynamoDB
- Event is emitted via DynamoDB Streams
- Data is synced to RDS for complex queries
- Full audit trail is maintained
- Multi-tenant isolation is enforced

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Your Application                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Client Request                                                     │
│        │                                                             │
│        ▼                                                             │
│   ┌─────────┐    ┌─────────┐    ┌──────────────┐                    │
│   │   API   │───▶│ Service │───▶│ CommandService│                    │
│   │ Gateway │    │  Layer  │    │   (Write)    │                    │
│   └─────────┘    └─────────┘    └──────────────┘                    │
│                       │                │                             │
│                       │                ▼                             │
│                       │         ┌──────────────┐                    │
│                       │         │  DynamoDB    │──── Stream ───┐    │
│                       │         │  (Commands)  │               │    │
│                       │         └──────────────┘               ▼    │
│                       │                              ┌──────────────┐│
│                       ▼                              │Step Functions││
│                ┌──────────────┐                      └──────────────┘│
│                │ DataService  │                              │       │
│                │   (Read)     │                              ▼       │
│                └──────────────┘                      ┌──────────────┐│
│                       │                              │  DynamoDB    ││
│                       ▼                              │   (Data)     ││
│                ┌──────────────┐                      └──────────────┘│
│                │     RDS      │◀──── Sync ───────────────────┘       │
│                │   (Query)    │                                      │
│                └──────────────┘                                      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Packages

| Package | Description | Version |
|---------|-------------|---------|
| [@mbc-cqrs-serverless/core](./packages/core) | Core CQRS framework with AWS integrations | [![npm](https://img.shields.io/npm/v/@mbc-cqrs-serverless/core.svg)](https://www.npmjs.com/package/@mbc-cqrs-serverless/core) |
| [@mbc-cqrs-serverless/cli](./packages/cli) | CLI tool for project scaffolding | [![npm](https://img.shields.io/npm/v/@mbc-cqrs-serverless/cli.svg)](https://www.npmjs.com/package/@mbc-cqrs-serverless/cli) |
| [@mbc-cqrs-serverless/tenant](./packages/tenant) | Multi-tenancy support | [![npm](https://img.shields.io/npm/v/@mbc-cqrs-serverless/tenant.svg)](https://www.npmjs.com/package/@mbc-cqrs-serverless/tenant) |
| [@mbc-cqrs-serverless/master](./packages/master) | Master data and hierarchical settings | [![npm](https://img.shields.io/npm/v/@mbc-cqrs-serverless/master.svg)](https://www.npmjs.com/package/@mbc-cqrs-serverless/master) |
| [@mbc-cqrs-serverless/sequence](./packages/sequence) | Sequence number generation with rotation | [![npm](https://img.shields.io/npm/v/@mbc-cqrs-serverless/sequence.svg)](https://www.npmjs.com/package/@mbc-cqrs-serverless/sequence) |
| [@mbc-cqrs-serverless/task](./packages/task) | Async task processing and queue management | [![npm](https://img.shields.io/npm/v/@mbc-cqrs-serverless/task.svg)](https://www.npmjs.com/package/@mbc-cqrs-serverless/task) |
| [@mbc-cqrs-serverless/import](./packages/import) | Data import with CSV and REST support | [![npm](https://img.shields.io/npm/v/@mbc-cqrs-serverless/import.svg)](https://www.npmjs.com/package/@mbc-cqrs-serverless/import) |
| [@mbc-cqrs-serverless/ui-setting](./packages/ui-setting) | UI configuration management | [![npm](https://img.shields.io/npm/v/@mbc-cqrs-serverless/ui-setting.svg)](https://www.npmjs.com/package/@mbc-cqrs-serverless/ui-setting) |

---

## Features

### Core Framework
- **CQRS Pattern** - Clean separation of commands (writes) and queries (reads)
- **Event Sourcing** - Complete audit trail with immutable event log
- **Optimistic Locking** - Automatic conflict resolution for concurrent updates

### AWS Integration
- **Lambda** - Serverless compute with automatic scaling
- **DynamoDB** - Event store and data persistence
- **RDS/Aurora** - Complex queries with Prisma ORM
- **Cognito** - Authentication and authorization
- **Step Functions** - Workflow orchestration
- **SNS/SQS** - Event-driven messaging

### Enterprise Features
- **Multi-tenancy** - Built-in tenant isolation and settings hierarchy
- **Sequence Generation** - Auto-incrementing IDs with date rotation
- **Master Data** - Centralized configuration management
- **Async Tasks** - Background job processing with retries

### Developer Experience
- **Full TypeScript** - Type-safe development with excellent IDE support
- **NestJS Foundation** - Familiar patterns and dependency injection
- **Local Development** - Complete offline mode with Docker
- **CLI Tools** - Project scaffolding and code generation

---

## Examples

Check out our [sample repository](https://github.com/mbc-net/mbc-cqrs-serverless-samples) for complete working examples:

| Example | Description |
|---------|-------------|
| [step-01-setup](https://github.com/mbc-net/mbc-cqrs-serverless-samples/tree/main/step-01-setup) | Environment setup |
| [step-02-create](https://github.com/mbc-net/mbc-cqrs-serverless-samples/tree/main/step-02-create) | Create operations with CommandService |
| [step-03-rds-sync](https://github.com/mbc-net/mbc-cqrs-serverless-samples/tree/main/step-03-rds-sync) | DynamoDB to RDS synchronization |
| [step-04-read](https://github.com/mbc-net/mbc-cqrs-serverless-samples/tree/main/step-04-read) | Read operations with DataService |
| [step-05-search](https://github.com/mbc-net/mbc-cqrs-serverless-samples/tree/main/step-05-search) | Search with Prisma/RDS |
| [step-06-update-delete](https://github.com/mbc-net/mbc-cqrs-serverless-samples/tree/main/step-06-update-delete) | Update and soft delete |
| [step-07-sequence](https://github.com/mbc-net/mbc-cqrs-serverless-samples/tree/main/step-07-sequence) | Sequence number generation |
| [complete/basic](https://github.com/mbc-net/mbc-cqrs-serverless-samples/tree/main/complete/basic) | Full CRUD implementation |

---

## Documentation

Visit our [documentation site](https://mbc-cqrs-serverless.mbc-net.com/) for:

- [Getting Started Guide](https://mbc-cqrs-serverless.mbc-net.com/docs/getting-started)
- [Build a Todo App Tutorial](https://mbc-cqrs-serverless.mbc-net.com/docs/build-todo-app)
- [API Reference](https://mbc-cqrs-serverless.mbc-net.com/docs/command-service)
- [Architecture Guide](https://mbc-cqrs-serverless.mbc-net.com/docs/introduction)

---

## Installation

### Latest Stable Release
```bash
npm install -g @mbc-cqrs-serverless/cli
```

### Beta Release (Latest Features)
```bash
npm install -g @mbc-cqrs-serverless/cli@beta
```

### Specific Version
```bash
npm install -g @mbc-cqrs-serverless/cli@1.0.17
```

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

```bash
# Clone the repository
git clone https://github.com/mbc-net/mbc-cqrs-serverless.git

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test
```

### Development Workflow
1. Fork the repository
2. Create a feature branch from `develop`
3. Make your changes with tests
4. Submit a pull request

---

## Community

- [GitHub Issues](https://github.com/mbc-net/mbc-cqrs-serverless/issues) - Bug reports and feature requests
- [GitHub Discussions](https://github.com/mbc-net/mbc-cqrs-serverless/discussions) - Questions and discussions
- [Changelog](https://mbc-cqrs-serverless.mbc-net.com/docs/changelog) - Release notes

---

## License

Copyright &copy; 2024-2025, [Murakami Business Consulting, Inc.](https://www.mbc-net.com/)

This project is licensed under the [MIT License](./LICENSE.txt).

---

<div align="center">

**[Get Started Now](https://mbc-cqrs-serverless.mbc-net.com/docs/getting-started)** | **[View Examples](https://github.com/mbc-net/mbc-cqrs-serverless-samples)** | **[Read the Docs](https://mbc-cqrs-serverless.mbc-net.com/)**

Made with love for the serverless community

</div>
