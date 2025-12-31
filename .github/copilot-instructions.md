# GitHub Copilot Instructions for MBC CQRS Serverless

## Project Overview

This is a TypeScript/NestJS monorepo implementing the CQRS (Command Query Responsibility Segregation) pattern for AWS serverless applications.

## Technology Stack

- TypeScript (ES2021) with strict mode
- NestJS v10.x framework
- AWS Lambda, DynamoDB, SNS/SQS, Cognito
- Lerna v8.x monorepo
- Jest v29.x testing

## Code Generation Guidelines

### Naming Conventions

When generating code, use these naming patterns:

```typescript
// Commands
CreateResourceCommand
UpdateResourceCommand
DeleteResourceCommand

// Events
ResourceCreatedEvent
ResourceUpdatedEvent
ResourceDeletedEvent

// Handlers
CreateResourceHandler
UpdateResourceHandler

// DTOs
CreateResourceDto
UpdateResourceDto
ResourceResponseDto

// Services
ResourceService
ResourceDataService
```

### Command Handler Pattern

Generate command handlers following this structure:

```typescript
import { CommandHandler, ICommandHandler } from '@mbc-cqrs-serverless/core';

@CommandHandler(CreateResourceCommand)
export class CreateResourceHandler implements ICommandHandler<CreateResourceCommand> {
  constructor(
    private readonly commandService: CommandService,
  ) {}

  async execute(command: CreateResourceCommand): Promise<DataEntity> {
    // Validate business rules
    // Create entity with proper pk/sk structure
    // Use commandService.publish() for persistence
    return this.commandService.publish(entity);
  }
}
```

### Entity Key Structure

Always use tenant-prefixed keys:

```typescript
// Partition Key (pk)
pk: `${tenantCode}#RESOURCE_TYPE`

// Sort Key (sk)
sk: `RESOURCE_TYPE#${resourceId}`
```

### Multi-Tenancy

Always include tenant context:

```typescript
const tenantCode = this.requestContext.getTenantCode();
```

### Error Handling

Use framework-provided exceptions:

```typescript
import { ValidationError, NotFoundError } from '@mbc-cqrs-serverless/core';

throw new ValidationError('Field is required');
throw new NotFoundError('Resource not found');
```

## Module Structure

Generate new modules with this structure:

```
src/resource/
├── commands/
│   ├── create-resource.command.ts
│   └── create-resource.handler.ts
├── queries/
│   ├── get-resource.query.ts
│   └── get-resource.handler.ts
├── dto/
│   ├── create-resource.dto.ts
│   └── resource-response.dto.ts
├── entities/
│   └── resource.entity.ts
├── controllers/
│   └── resource.controller.ts
└── resource.module.ts
```

## Testing Patterns

Generate tests with AWS SDK mocking:

```typescript
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

describe('ResourceHandler', () => {
  const ddbMock = mockClient(DynamoDBDocumentClient);

  beforeEach(() => {
    ddbMock.reset();
  });

  it('should create resource', async () => {
    // Arrange
    ddbMock.on(PutCommand).resolves({});

    // Act & Assert
  });
});
```

## Documentation Requirements

- All code comments in English
- Use JSDoc for public APIs
- Include @example tags where helpful

## Packages Reference

| Package | Import Path |
|---------|-------------|
| Core | `@mbc-cqrs-serverless/core` |
| Master | `@mbc-cqrs-serverless/master` |
| Tenant | `@mbc-cqrs-serverless/tenant` |
| Sequence | `@mbc-cqrs-serverless/sequence` |
| Task | `@mbc-cqrs-serverless/task` |

## Common Imports

```typescript
// Core imports
import {
  CommandHandler,
  ICommandHandler,
  CommandService,
  DataService,
  InjectDataService,
} from '@mbc-cqrs-serverless/core';

// NestJS imports
import { Injectable, Controller, Get, Post, Body } from '@nestjs/common';
```
