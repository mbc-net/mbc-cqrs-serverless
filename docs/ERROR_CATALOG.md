# Error Catalog

This catalog documents common errors in MBC CQRS Serverless, their causes, and solutions.

## Command Service Errors

### BadRequestException: "The input is not a valid, item not found or version not match"

**Location**: `packages/core/src/commands/command.service.ts`

**Cause**: Optimistic locking failure. The version number in your request doesn't match the current version in the database. This happens when:
- Another process updated the item between your read and write
- You're using an outdated version number

**Solution**:
```typescript
// 1. Fetch latest version before update
const latest = await dataService.getItem({ pk, sk });

// 2. Use the current version
await commandService.publishPartialUpdateSync({
  pk,
  sk,
  version: latest.version,  // Use latest version
  name: 'Updated Name',
}, options);

// 3. Or use version: -1 for auto-fetch (async mode only)
await commandService.publishPartialUpdateAsync({
  pk,
  sk,
  version: -1,  // Auto-fetches latest
  name: 'Updated Name',
}, options);
```

---

### BadRequestException: "The input key is not a valid, item not found"

**Location**: `packages/core/src/commands/command.service.ts`

**Cause**: Attempting to update an item that doesn't exist in the database.

**Solution**:
1. Verify the pk/sk values are correct
2. Check if the item was deleted
3. Use `publishAsync` which can create new items

```typescript
// Check if item exists first
const existing = await dataService.getItem({ pk, sk });
if (!existing) {
  // Create new item instead of update
  await commandService.publishAsync(newItem, options);
}
```

---

### BadRequestException: "Invalid input version. The input version must be equal to the latest version"

**Location**: `packages/core/src/commands/command.service.ts`

**Cause**: Using `publishSync` with a version that doesn't match the latest stored version.

**Solution**:
- Fetch the latest item and use its version
- Use `version: -1` with async methods for auto-versioning

---

## Tenant Errors

### BadRequestException: "Tenant not found"

**Location**: `packages/tenant/src/services/tenant.service.ts`

**Cause**: The specified tenant doesn't exist or has been deleted.

**Solution**:
1. Verify the tenant code is correct
2. Check if tenant was soft-deleted (`isDeleted: true`)
3. Create the tenant if it should exist

```typescript
// List all tenants to verify
const tenants = await tenantService.listTenants();
```

---

### BadRequestException: "Tenant code {code} already existed"

**Location**: `packages/tenant/src/services/tenant.service.ts`

**Cause**: Attempting to create a tenant with a code that already exists.

**Solution**:
1. Use a different tenant code
2. If re-creating after delete, the existing code can be reused (version will increment)

---

## Validation Errors

### BadRequestException: "Validation failed"

**Location**: `packages/core/src/pipe/class.validation.pipe.ts`

**Cause**: Request DTO failed class-validator validation.

**Solution**:
1. Check your request body against the DTO definition
2. Common issues:
   - Missing required fields
   - Wrong data types
   - Invalid format (email, date, etc.)

```typescript
// Example: Ensure required fields are present
const dto: CreateOrderDto = {
  name: 'Order Name',      // Required
  code: 'ORD001',          // Required
  // Check DTO definition for all required fields
};
```

---

### BadRequestException: "Invalid tenant code"

**Location**: Multiple services

**Cause**: The `x-tenant-code` header is missing or invalid.

**Solution**:
```typescript
// Ensure header is set in requests
headers: {
  'x-tenant-code': 'YOUR_TENANT_CODE',
  'Authorization': 'Bearer ...'
}
```

---

## Event Handling Errors

### EventHandlerNotFoundException

**Location**: `packages/core/src/events/event-bus.ts`

**Cause**: No handler registered for the event type.

**Solution**:
1. Register the event handler with `@EventHandler()` decorator
2. Import the handler in your module

```typescript
// 1. Create handler
@EventHandler(OrderCreatedEvent)
export class OrderCreatedHandler implements IEventHandler<OrderCreatedEvent> {
  async execute(event: OrderCreatedEvent) {
    // Handle event
  }
}

// 2. Register in module
@Module({
  providers: [OrderCreatedHandler],
})
export class OrderModule {}
```

---

## Master Data Errors

### BadRequestException: "Setting not found with code: {code}"

**Location**: `packages/master/src/services/master-setting.service.ts`

**Cause**: The requested master setting code doesn't exist.

**Solution**:
1. Verify the setting code is correct
2. Create the setting if it should exist

---

### BadRequestException: "Setting already exists: {code}"

**Location**: `packages/master/src/services/master-setting.service.ts`

**Cause**: Attempting to create a master setting with a code that already exists.

**Solution**:
1. Use a different code
2. Update the existing setting instead of creating

---

### BadRequestException: "Must provide master setting code"

**Location**: `packages/master/src/custom-task/my-task.service.ts`

**Cause**: Task execution requires a master setting code that wasn't provided.

**Solution**:
```typescript
// Provide the required setting code
await myTaskService.execute({
  masterSettingCode: 'YOUR_SETTING_CODE',
  // other options...
});
```

---

## UI Setting Errors

### NotFoundException: "Setting code is not exist!"

**Location**: `packages/ui-setting/src/services/data-setting.service.ts`

**Cause**: The UI setting code doesn't exist in the system.

**Solution**:
1. Verify the setting code
2. Create the setting first before creating data settings

---

### BadRequestException: "Data setting is exist!"

**Location**: `packages/ui-setting/src/services/data-setting.service.ts`

**Cause**: Attempting to create a data setting that already exists.

**Solution**:
1. Use update instead of create
2. Delete the existing setting first if you need to recreate

---

### BadRequestException: "This setting is already delete!"

**Location**: `packages/ui-setting/src/services/setting.service.ts`

**Cause**: Attempting to delete a setting that's already deleted.

**Solution**:
1. Check `isDeleted` flag before attempting delete
2. Use restore operation if you need to recover the setting

---

## Directory Errors

### ForbiddenException: "Permission denied"

**Location**: `packages/directory/src/directory.service.ts`

**Cause**: User doesn't have permission to perform the operation on this directory.

**Solution**:
1. Verify user has appropriate role
2. Check directory ownership
3. Request permission from directory owner

---

### BadRequestException: "Directory is not deleted!"

**Location**: `packages/directory/src/directory.service.ts`

**Cause**: Attempting to restore a directory that isn't deleted.

**Solution**:
1. Check `isDeleted` flag
2. Only call restore on deleted directories

---

## DynamoDB Errors

### ProvisionedThroughputExceededException

**Location**: AWS DynamoDB

**Cause**: Read or write capacity exceeded.

**Solution**:
1. Increase provisioned capacity
2. Switch to on-demand capacity mode
3. Implement exponential backoff retry

```typescript
// Example retry with exponential backoff
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.name === 'ProvisionedThroughputExceededException') {
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 100));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

### ConditionalCheckFailedException

**Location**: AWS DynamoDB

**Cause**: Optimistic locking condition failed (version mismatch).

**Solution**:
Same as "version not match" error above - refresh and retry.

---

## HTTP Status Code Reference

| Status | Exception | Meaning |
|--------|-----------|---------|
| 400 | BadRequestException | Invalid input or business rule violation |
| 401 | UnauthorizedException | Missing or invalid authentication |
| 403 | ForbiddenException | Authenticated but not authorized |
| 404 | NotFoundException | Resource not found |
| 409 | ConflictException | Version conflict (optimistic locking) |
| 500 | InternalServerErrorException | Unexpected server error |

---

## Debugging Tips

1. **Enable debug logging**:
   ```bash
   DEBUG=* npm run offline
   ```

2. **Check CloudWatch logs** for Lambda errors

3. **Use request ID** for tracing:
   ```typescript
   // Request ID is in response headers and logs
   console.log('RequestId:', context.awsRequestId);
   ```

4. **Verify environment variables** are set correctly

5. **Check DynamoDB table** exists and has correct schema
