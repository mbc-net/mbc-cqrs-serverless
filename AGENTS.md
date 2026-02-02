# AI Agent Guidelines for MBC CQRS Serverless

This document provides guidance for AI coding assistants (GitHub Copilot, Codeium, Cursor, etc.) working with this codebase.

## Project Overview

MBC CQRS Serverless is a TypeScript monorepo implementing the CQRS (Command Query Responsibility Segregation) pattern for AWS serverless architectures using NestJS.

## Quick Reference

### Technology Stack

| Category | Technology |
|----------|------------|
| Language | TypeScript (ES2021) |
| Framework | NestJS v10.x |
| Runtime | Node.js 18+ / AWS Lambda |
| Database | DynamoDB (primary), RDS/Aurora (optional) |
| Package Manager | npm with workspaces |
| Monorepo Tool | Lerna v8.x |
| Infrastructure | AWS CDK v2, Serverless Framework |
| Testing | Jest v29.x |

### Package Structure

| Package | Purpose | npm Scope |
|---------|---------|-----------|
| core | Main CQRS framework | @mbc-cqrs-serverless/core |
| cli | Project scaffolding | @mbc-cqrs-serverless/cli |
| master | Master data management | @mbc-cqrs-serverless/master |
| sequence | ID sequence generation | @mbc-cqrs-serverless/sequence |
| task | Async task management | @mbc-cqrs-serverless/task |
| tenant | Multi-tenancy | @mbc-cqrs-serverless/tenant |
| ui-setting | UI configuration | @mbc-cqrs-serverless/ui-setting |
| import | Data import | @mbc-cqrs-serverless/import |
| directory | Directory management | @mbc-cqrs-serverless/directory |

### Project Structure

```
/
├── packages/           # Core framework packages
│   ├── core/          # Main CQRS framework (AWS integrations)
│   ├── cli/           # Scaffolding CLI tool
│   ├── master/        # Master data management
│   ├── sequence/      # Sequence generation
│   ├── task/          # Task management
│   ├── tenant/        # Multi-tenancy support
│   └── ui-setting/    # UI configuration
├── examples/          # Implementation examples
├── docs/              # Documentation
└── infra/             # Infrastructure templates
```

## Code Patterns

### Creating Commands

```typescript
// Define command
export class CreateResourceCommand {
  constructor(
    public readonly tenantCode: string,
    public readonly data: CreateResourceDto,
  ) {}
}

// Implement handler
@CommandHandler(CreateResourceCommand)
export class CreateResourceHandler implements ICommandHandler<CreateResourceCommand> {
  constructor(
    private readonly commandService: CommandService,
  ) {}

  async execute(command: CreateResourceCommand): Promise<DataEntity> {
    const { tenantCode, data } = command;

    // Business logic
    const entity = new DataEntity();
    entity.pk = `${tenantCode}#RESOURCE`;
    entity.sk = generateId();
    entity.name = data.name;

    // Persist and publish event
    return this.commandService.publish(entity);
  }
}
```

### Creating Event Handlers

```typescript
@EventsHandler(ResourceCreatedEvent)
export class ResourceCreatedHandler implements IEventHandler<ResourceCreatedEvent> {
  async handle(event: ResourceCreatedEvent): Promise<void> {
    // Handle side effects
    // Send notifications, update read models, etc.
  }
}
```

### Data Access with DataService

```typescript
// Query single item
const item = await this.dataService.getItem({
  pk: 'TENANT#001',
  sk: 'RESOURCE#123',
});

// Query multiple items
const items = await this.dataService.query({
  pk: 'TENANT#001',
  sk: { beginsWith: 'RESOURCE#' },
});
```

### Multi-tenant Data Isolation

```typescript
// Tenant-aware operations
const tenantCode = this.requestContext.getTenantCode();
const pk = `${tenantCode}#RESOURCE`;
```

## Module Structure Convention

Each feature module should follow this structure:

```
src/feature/
├── controllers/
│   └── feature.controller.ts    # REST/GraphQL endpoints
├── commands/
│   ├── create-feature.command.ts
│   └── create-feature.handler.ts
├── queries/
│   ├── get-feature.query.ts
│   └── get-feature.handler.ts
├── events/
│   └── feature-created.event.ts
├── dto/
│   ├── create-feature.dto.ts
│   └── feature-response.dto.ts
├── entities/
│   └── feature.entity.ts
└── feature.module.ts
```

## Testing Guidelines

### Unit Tests

```typescript
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

describe('CreateResourceHandler', () => {
  const ddbMock = mockClient(DynamoDBDocumentClient);

  beforeEach(() => {
    ddbMock.reset();
  });

  it('should create resource successfully', async () => {
    // Arrange
    ddbMock.on(PutCommand).resolves({});

    // Act
    const result = await handler.execute(command);

    // Assert
    expect(result).toBeDefined();
  });
});
```

### E2E Tests

```typescript
describe('ResourceController (e2e)', () => {
  it('POST /resources', () => {
    return request(app.getHttpServer())
      .post('/resources')
      .send({ name: 'Test Resource' })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
      });
  });
});
```

## Common Commands

```bash
# Development
npm run build               # Build all packages
npm run test                # Run unit tests
npm run test:e2e            # Run E2E tests
npm run lint                # ESLint check
npm run format              # Prettier format
npm run start:localstack    # Start local AWS services
npm run offline             # Start serverless offline

# Database
npm run ddb:create          # Create DynamoDB tables

# Code Generation
mbc generate module NAME    # Generate new module
mbc generate controller NAME
mbc generate service NAME
```

## Documentation Requirements

- All public documentation: **English**
- Code comments: **English**
- Commit messages: **English**
- Internal configuration (CLAUDE.md): Japanese allowed

## Related Files

- [CLAUDE.md](./CLAUDE.md): Claude Code specific detailed guidance (Japanese)
- [llms.txt](./llms.txt): Standard AI agent context file
- [.cursorrules](./.cursorrules): Cursor IDE configuration
- [README.md](./README.md): Project overview and getting started

## External Resources

- Full Documentation: https://mbc-cqrs-serverless.mbc-net.com/
- Examples: https://github.com/mbc-net/mbc-cqrs-serveless-samples
- NestJS Docs: https://docs.nestjs.com/
- AWS SDK v3: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/
