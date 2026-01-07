![MBC CQRS serverless framework](https://mbc-cqrs-serverless.mbc-net.com/img/mbc-cqrs-serverless.png)

# @mbc-cqrs-serverless/core

[![npm version](https://badge.fury.io/js/@mbc-cqrs-serverless%2Fcore.svg)](https://www.npmjs.com/package/@mbc-cqrs-serverless/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

The core package of the MBC CQRS Serverless framework, providing a complete implementation of CQRS (Command Query Responsibility Segregation) and Event Sourcing patterns for AWS serverless architectures.

## Features

- **CQRS Pattern**: Separate command (write) and query (read) operations for better scalability
- **Event Sourcing**: Full audit trail with versioned commands and optimistic locking
- **AWS Integration**: Built-in support for DynamoDB, Step Functions, SNS, SQS, S3, and Cognito
- **Multi-tenancy**: Tenant isolation with automatic context management
- **NestJS Framework**: Leverage dependency injection, decorators, and modular architecture
- **TypeScript First**: Full type safety and excellent IDE support

## Installation

```bash
npm install @mbc-cqrs-serverless/core
```

## Quick Start

### 1. Configure the Module

```typescript
import { Module } from '@nestjs/common';
import { CommandModule, DataService, CommandService } from '@mbc-cqrs-serverless/core';

@Module({
  imports: [
    CommandModule.register({
      tableName: 'todo',
    }),
  ],
})
export class TodoModule {}
```

### 2. Inject Services

```typescript
import { Injectable } from '@nestjs/common';
import {
  CommandService,
  DataService,
  generateId,
  getUserContext,
  VERSION_FIRST,
  IInvoke,
} from '@mbc-cqrs-serverless/core';

@Injectable()
export class TodoService {
  constructor(
    private readonly commandService: CommandService,
    private readonly dataService: DataService,
  ) {}

  async create(dto: CreateTodoDto, opts: { invokeContext: IInvoke }) {
    const { tenantCode } = getUserContext(opts.invokeContext);
    const pk = `TODO#${tenantCode}`;
    const sk = `TODO#${Date.now()}`;

    const command = {
      pk,
      sk,
      id: generateId(pk, sk),
      tenantCode,
      code: sk,
      type: 'TODO',
      version: VERSION_FIRST,
      name: dto.name,
      attributes: dto.attributes,
    };

    return await this.commandService.publishAsync(command, opts);
  }

  async findOne(pk: string, sk: string) {
    return await this.dataService.getItem({ pk, sk });
  }
}
```

## Key Concepts

### CQRS Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client    │────▶│  CommandService │────▶│ DynamoDB        │
│   (Write)   │     │  (publishAsync) │     │ (Command Table) │
└─────────────┘     └─────────────────┘     └────────┬────────┘
                                                     │
                                                     ▼ DynamoDB Streams
                                            ┌─────────────────┐
                                            │ Step Functions  │
                                            │ (Data Sync)     │
                                            └────────┬────────┘
                                                     │
┌─────────────┐     ┌─────────────────┐     ┌────────▼────────┐
│   Client    │────▶│   DataService   │────▶│ DynamoDB        │
│   (Read)    │     │   (getItem)     │     │ (Data Table)    │
└─────────────┘     └─────────────────┘     └─────────────────┘
```

### Command vs Data Tables

| Aspect | Command Table | Data Table |
|--------|---------------|------------|
| Purpose | Event log / Audit trail | Current state |
| Versioning | All versions stored | Latest version only |
| Sort Key | Includes version (sk#v001) | No version suffix |
| Use Case | Write operations | Read operations |

### Version Control

Every command includes a version number for optimistic locking:

```typescript
// VERSION_FIRST = 0 for new items
const command = { pk, sk, version: VERSION_FIRST, ... };
await commandService.publishAsync(command, opts);

// Updates require the current version
const updateCommand = { pk, sk, version: currentVersion, ... };
await commandService.publishPartialUpdateAsync(updateCommand, opts);
```

## API Reference

### CommandService

The primary service for write operations.

| Method | Description |
|--------|-------------|
| `publishAsync(input, options)` | Create or update an item asynchronously via Step Functions |
| `publishSync(input, options)` | Create or update an item synchronously (bypasses Step Functions) |
| `publishPartialUpdateAsync(input, options)` | Partial update with field merging (async) |
| `publishPartialUpdateSync(input, options)` | Partial update with field merging (sync) |
| `getItem(key)` | Get a specific command version |
| `getLatestItem(key)` | Get the latest command version |
| `duplicate(key, options)` | Duplicate an existing command |
| `reSyncData()` | Re-synchronize all data to sync handlers |

### DataService

The primary service for read operations.

| Method | Description |
|--------|-------------|
| `getItem(key)` | Retrieve a single item by pk and sk |
| `listItemsByPk(pk, options)` | List items by partition key with filtering and pagination |

### Helper Functions

```typescript
import {
  generateId,        // Generate unique ID from pk and sk
  getUserContext,    // Extract user info from Lambda context
  addSortKeyVersion, // Add version suffix to sort key
  removeSortKeyVersion, // Remove version suffix from sort key
  getTenantCode,     // Extract tenant code from partition key
} from '@mbc-cqrs-serverless/core';
```

### Constants

```typescript
import {
  VERSION_FIRST,   // Initial version (0)
  VERSION_LATEST,  // Marker for latest version (-1)
  VER_SEPARATOR,   // Version separator in sort key ('#')
} from '@mbc-cqrs-serverless/core';
```

## Data Sync Handlers

Extend data synchronization to custom destinations (e.g., RDS, Elasticsearch):

```typescript
import { Injectable } from '@nestjs/common';
import {
  IDataSyncHandler,
  DataSyncHandler,
  CommandModel,
} from '@mbc-cqrs-serverless/core';
import { PrismaService } from '../prisma/prisma.service';

@DataSyncHandler({ tableName: 'todo' })
@Injectable()
export class TodoDataSyncHandler implements IDataSyncHandler {
  type = 'rds';

  constructor(private readonly prisma: PrismaService) {}

  async up(cmd: CommandModel): Promise<void> {
    await this.prisma.todo.upsert({
      where: { pk_sk: { pk: cmd.pk, sk: cmd.sk } },
      create: { /* ... */ },
      update: { /* ... */ },
    });
  }

  async down(cmd: CommandModel): Promise<void> {
    // Optional: handle rollback
  }
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DYNAMODB_ENDPOINT` | DynamoDB endpoint URL | AWS default |
| `DYNAMODB_REGION` | DynamoDB region | AWS default |
| `SFN_ENDPOINT` | Step Functions endpoint | AWS default |
| `SFN_REGION` | Step Functions region | AWS default |
| `SNS_ENDPOINT` | SNS endpoint | AWS default |
| `SQS_ENDPOINT` | SQS endpoint | AWS default |
| `COGNITO_ENDPOINT` | Cognito endpoint | AWS default |
| `COGNITO_REGION` | Cognito region | AWS default |

## Related Packages

| Package | Description |
|---------|-------------|
| [@mbc-cqrs-serverless/cli](https://www.npmjs.com/package/@mbc-cqrs-serverless/cli) | CLI for project scaffolding |
| [@mbc-cqrs-serverless/sequence](https://www.npmjs.com/package/@mbc-cqrs-serverless/sequence) | Sequence number generation |
| [@mbc-cqrs-serverless/task](https://www.npmjs.com/package/@mbc-cqrs-serverless/task) | Async task processing |
| [@mbc-cqrs-serverless/master](https://www.npmjs.com/package/@mbc-cqrs-serverless/master) | Master data management |
| [@mbc-cqrs-serverless/tenant](https://www.npmjs.com/package/@mbc-cqrs-serverless/tenant) | Multi-tenancy support |
| [@mbc-cqrs-serverless/import](https://www.npmjs.com/package/@mbc-cqrs-serverless/import) | Data import utilities |
| [@mbc-cqrs-serverless/ui-setting](https://www.npmjs.com/package/@mbc-cqrs-serverless/ui-setting) | UI configuration |

## Documentation

Full documentation is available at [https://mbc-cqrs-serverless.mbc-net.com/](https://mbc-cqrs-serverless.mbc-net.com/)

- [Getting Started](https://mbc-cqrs-serverless.mbc-net.com/docs/introduction)
- [Build a Todo App Tutorial](https://mbc-cqrs-serverless.mbc-net.com/docs/build-todo-app)
- [Architecture Guide](https://mbc-cqrs-serverless.mbc-net.com/docs/architecture-overview)
- [API Reference](https://mbc-cqrs-serverless.mbc-net.com/docs/command-service)

## License

Copyright © 2024-2025, Murakami Business Consulting, Inc. [https://www.mbc-net.com/](https://www.mbc-net.com/)

This project is under the [MIT License](../../LICENSE.txt).
