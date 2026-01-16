---
name: mbc-review
description: Review code for MBC CQRS Serverless best practices and anti-patterns. Use this when reviewing code that uses MBC CQRS Serverless framework, checking for common mistakes, or validating implementation patterns.
---

## Pre-flight Check (Version Update)

Before executing this skill, check for updates:

1. Run `mbc install-skills --check` to check if a newer version is available
2. If the output shows "Update available: X.Y.Z → A.B.C", ask the user:
   - "A newer version of MBC skills is available (X.Y.Z → A.B.C). Would you like to update before proceeding?"
3. If the user agrees, run `mbc install-skills --force` to update
4. If the user declines or skills are up-to-date, proceed with the skill

**Note**: Skip this check if the user explicitly says to skip updates or if you've already checked in this session.

---

# MBC CQRS Serverless Code Review

This skill reviews code for MBC CQRS Serverless best practices and identifies anti-patterns.

## Anti-Patterns to Detect

### AP001: Using publishSync Instead of publishAsync

**Severity:** Warning

**Pattern:**
```typescript
// Bad
await this.commandService.publishSync(command, options);

// Good
await this.commandService.publishAsync(command, options);
```

**Explanation:** `publishAsync` is the recommended default. Only use `publishSync` when immediate consistency is absolutely required, as it blocks until processing completes.

---

### AP002: Missing tenantCode in Multi-Tenant Operations

**Severity:** Error

**Pattern:**
```typescript
// Bad
const pk = `ORDER#${code}`;

// Good
const { tenantCode } = getUserContext(invokeContext);
const pk = `ORDER#${tenantCode}`;
```

**Explanation:** All operations must include `tenantCode` for proper tenant isolation.

---

### AP003: Hardcoded Version Numbers

**Severity:** Error

**Pattern:**
```typescript
// Bad
version: 1,
version: 0,

// Good
version: VERSION_FIRST,  // For new entities (0)
version: existingItem.version,  // For updates
```

**Explanation:** Use `VERSION_FIRST` constant for new entities. For updates, always fetch the current version to enable optimistic locking.

---

### AP004: Missing DataSyncHandler Registration

**Severity:** Error

**Pattern:**
```typescript
// Bad
CommandModule.register({
  tableName: 'order',
  // dataSyncHandlers missing!
}),

// Good
CommandModule.register({
  tableName: 'order',
  dataSyncHandlers: [OrderDataSyncRdsHandler],
}),
```

**Explanation:** If you have DataSyncHandlers, they must be registered in the module.

---

### AP005: Not Handling ConditionalCheckFailedException

**Severity:** Warning

**Pattern:**
```typescript
// Bad
await this.commandService.publishAsync(command, options);

// Good
try {
  await this.commandService.publishAsync(command, options);
} catch (error) {
  if (error.name === 'ConditionalCheckFailedException') {
    // Handle version conflict - retry or inform user
    throw new ConflictException('Data was modified by another user');
  }
  throw error;
}
```

**Explanation:** Optimistic locking can cause version conflicts that should be handled gracefully.

---

### AP006: Using Wrong PK/SK Format

**Severity:** Error

**Pattern:**
```typescript
// Bad - inconsistent format
const pk = `order-${tenantCode}`;
const sk = `order_${code}`;

// Good - consistent ENTITY#value format
const pk = `ORDER#${tenantCode}`;
const sk = `ORDER#${code}`;
```

**Explanation:** Follow the `ENTITY#value` convention for partition and sort keys.

---

### AP007: Missing invokeContext in Service Methods

**Severity:** Error

**Pattern:**
```typescript
// Bad
async create(dto: CreateOrderDto) {
  // No way to get user context
}

// Good
async create(dto: CreateOrderDto, invokeContext: IInvoke) {
  const { tenantCode, userId } = getUserContext(invokeContext);
}
```

**Explanation:** `invokeContext` is required to extract user information and tenant context.

---

### AP008: Not Using generateId for Entity IDs

**Severity:** Warning

**Pattern:**
```typescript
// Bad
id: uuid(),
id: `${pk}-${sk}`,

// Good
id: generateId(pk, sk),
```

**Explanation:** Use `generateId()` for consistent ID generation across the framework.

---

### AP009: Missing DTO Validation Decorators

**Severity:** Warning

**Pattern:**
```typescript
// Bad
export class CreateOrderDto {
  code: string;
  name: string;
}

// Good
export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}
```

**Explanation:** Always use class-validator decorators for input validation.

---

### AP010: Deprecated Method Usage

**Severity:** Warning

**Pattern:**
```typescript
// Bad - deprecated
await this.commandService.publish(command, options);
await this.commandService.publishPartialUpdate(command, options);

// Good - use Async variants
await this.commandService.publishAsync(command, options);
await this.commandService.publishPartialUpdateAsync(command, options);
```

**Explanation:** The non-Async methods are deprecated. Use `publishAsync` and `publishPartialUpdateAsync`.

---

### AP011: Missing getCommandSource for Tracing

**Severity:** Warning

**Pattern:**
```typescript
// Bad - no source tracking
await this.commandService.publishAsync(command, {
  invokeContext,
});

// Good - with source tracking
const commandSource = getCommandSource(
  basename(__dirname),
  this.constructor.name,
  'create',
);

await this.commandService.publishAsync(command, {
  source: commandSource,
  invokeContext,
});
```

**Explanation:** Always include `source` in publish options for debugging and audit trails.

---

### AP012: Direct DynamoDB Access Instead of DataService

**Severity:** Warning

**Pattern:**
```typescript
// Bad - direct DynamoDB access
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({});
const result = await client.send(new GetItemCommand({
  TableName: 'my-table',
  Key: { pk: { S: 'ORDER#tenant' }, sk: { S: 'ORDER#123' } },
}));

// Good - use DataService
const result = await this.dataService.getItem({ pk, sk });
```

**Explanation:** Use `DataService` for read operations. It provides caching, consistent interfaces, and proper error handling.

---

### AP013: Missing Type Declaration in DataSyncHandler

**Severity:** Error

**Pattern:**
```typescript
// Bad - missing type
@DataSyncHandler({})
export class OrderDataSyncRdsHandler implements IDataSyncHandler {
  // ...
}

// Good - with type declaration
@DataSyncHandler({ type: 'ORDER' })
export class OrderDataSyncRdsHandler implements IDataSyncHandler {
  // ...
}
```

**Explanation:** The `type` property in `@DataSyncHandler` decorator must match your entity's `type` field to route events correctly.

---

### AP014: Not Using DetailKey Type

**Severity:** Info

**Pattern:**
```typescript
// Bad - inline key definition
async findOne(pk: string, sk: string) {
  return this.dataService.getItem({ pk, sk });
}

// Good - use DetailKey type
import { DetailKey } from '@mbc-cqrs-serverless/core';

async findOne(key: DetailKey) {
  return this.dataService.getItem(key);
}
```

**Explanation:** Use the `DetailKey` type for consistency and type safety across the application.

---

### AP015: Hardcoded Table Names

**Severity:** Warning

**Pattern:**
```typescript
// Bad - hardcoded table name
CommandModule.register({
  tableName: 'production-orders',
  dataSyncHandlers: [OrderDataSyncRdsHandler],
}),

// Good - use environment variable or configuration
CommandModule.register({
  tableName: process.env.ORDER_TABLE_NAME || 'orders',
  dataSyncHandlers: [OrderDataSyncRdsHandler],
}),
```

**Explanation:** Table names should come from environment variables to support multiple environments (dev, staging, production).

---

### AP016: Missing Error Logging

**Severity:** Warning

**Pattern:**
```typescript
// Bad - silently catching errors
try {
  await this.commandService.publishAsync(command, options);
} catch (error) {
  throw new InternalServerErrorException();
}

// Good - log before rethrowing
private readonly logger = new Logger(OrderService.name);

try {
  await this.commandService.publishAsync(command, options);
} catch (error) {
  this.logger.error(`Failed to create order: ${error.message}`, error.stack);
  if (error.name === 'ConditionalCheckFailedException') {
    throw new ConflictException('Data was modified by another user');
  }
  throw error;
}
```

**Explanation:** Always log errors with context before handling them for debugging purposes.

---

### AP017: Incorrect Attribute Merging

**Severity:** Error

**Pattern:**
```typescript
// Bad - overwrites all attributes
await this.commandService.publishPartialUpdateAsync({
  pk: key.pk,
  sk: key.sk,
  version: existingItem.version,
  attributes: dto.attributes, // Overwrites existing attributes!
}, options);

// Good - merge attributes properly
await this.commandService.publishPartialUpdateAsync({
  pk: key.pk,
  sk: key.sk,
  version: existingItem.version,
  attributes: { ...existingItem.attributes, ...dto.attributes },
}, options);
```

**Explanation:** When updating, merge new attributes with existing ones to avoid data loss.

---

### AP018: Missing Swagger Documentation

**Severity:** Info

**Pattern:**
```typescript
// Bad - no documentation
@Controller('orders')
export class OrderController {
  @Post()
  async create(@Body() dto: CreateOrderDto) {}
}

// Good - with Swagger documentation
@ApiTags('orders')
@Controller('orders')
export class OrderController {
  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 409, description: 'Order already exists' })
  async create(@Body() dto: CreateOrderDto) {}
}
```

**Explanation:** Add Swagger decorators for API documentation and better developer experience.

---

### AP019: Not Handling Pagination Correctly

**Severity:** Warning

**Pattern:**
```typescript
// Bad - no pagination support
async search(dto: SearchOrderDto, invokeContext: IInvoke) {
  const { tenantCode } = getUserContext(invokeContext);
  return this.dataService.listByPk({
    pk: `ORDER#${tenantCode}`,
  }); // Returns all items!
}

// Good - with proper pagination
async search(dto: SearchOrderDto, invokeContext: IInvoke) {
  const { tenantCode } = getUserContext(invokeContext);
  return this.dataService.listByPk({
    pk: `ORDER#${tenantCode}`,
    limit: dto.limit || 20,
    cursor: dto.cursor,
  });
}
```

**Explanation:** Always implement pagination to avoid returning large datasets and causing performance issues.

---

### AP020: Circular Module Dependencies

**Severity:** Error

**Pattern:**
```typescript
// Bad - circular dependency
// order.module.ts
@Module({
  imports: [ProductModule], // ProductModule imports OrderModule
})
export class OrderModule {}

// product.module.ts
@Module({
  imports: [OrderModule], // Circular!
})
export class ProductModule {}

// Good - use forwardRef or restructure
// order.module.ts
@Module({
  imports: [forwardRef(() => ProductModule)],
})
export class OrderModule {}

// Better - extract shared logic to a common module
@Module({
  imports: [SharedModule],
})
export class OrderModule {}
```

**Explanation:** Avoid circular dependencies. Use `forwardRef()` as a last resort, or better, restructure your modules.

---

## Review Checklist

When reviewing MBC CQRS Serverless code, check:

### Module Structure
- [ ] Module properly imports `CommandModule.register()`
- [ ] DataSyncHandlers are registered
- [ ] Services and controllers are properly provided

### Service Layer
- [ ] All methods receive `invokeContext: IInvoke`
- [ ] `getUserContext()` is used to extract tenant info
- [ ] `publishAsync` is used (not `publishSync`)
- [ ] `VERSION_FIRST` is used for new entities
- [ ] Existing version is fetched for updates
- [ ] `generateId()` is used for ID generation
- [ ] `getCommandSource()` is used for tracing

### DTOs
- [ ] class-validator decorators are present
- [ ] Swagger decorators for API documentation
- [ ] CommandDto extends the base class

### Controller
- [ ] `@INVOKE_CONTEXT()` decorator is used
- [ ] Proper HTTP methods (POST for create, PUT for update, etc.)
- [ ] API tags and documentation

### Error Handling
- [ ] ConditionalCheckFailedException is handled
- [ ] Proper HTTP exceptions are thrown
- [ ] Errors are logged appropriately

### Data Sync Handler
- [ ] `@DataSyncHandler({ type: 'ENTITY' })` decorator is present
- [ ] Implements `IDataSyncHandler`
- [ ] Handles both create/update and delete cases
- [ ] Registered in module

## Output Format

When reviewing, provide output in this format:

```
## Code Review: [File Name]

### Issues Found

#### [AP00X] Issue Title
- **Severity:** Error/Warning/Info
- **Location:** Line XX
- **Current Code:**
  ```typescript
  // problematic code
  ```
- **Suggested Fix:**
  ```typescript
  // corrected code
  ```
- **Explanation:** Why this is an issue

### Summary

| Severity | Count |
|----------|-------|
| Error    | X     |
| Warning  | X     |
| Info     | X     |

### Recommendations
1. Priority fixes...
2. Suggested improvements...
```
