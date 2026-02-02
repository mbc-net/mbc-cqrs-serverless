---
name: mbc-debug
description: Debug and troubleshoot MBC CQRS Serverless applications. Use this when encountering errors, investigating issues, or optimizing performance in MBC CQRS Serverless projects.
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

# MBC CQRS Serverless Debug Guide

This skill helps debug and troubleshoot issues in MBC CQRS Serverless applications.

## Quick Error Lookup

### Common Error Codes

| Error Code | Category | Quick Fix |
|------------|----------|-----------|
| MBC-CMD-001 | Command | Check pk/sk format |
| MBC-CMD-002 | Command | Verify version field |
| MBC-CMD-003 | Command | Check command type |
| MBC-DDB-001 | DynamoDB | Verify table exists |
| MBC-DDB-002 | DynamoDB | Check IAM permissions |
| MBC-DDB-003 | DynamoDB | Resolve version conflict |
| MBC-TNT-001 | Tenant | Verify tenantCode |
| MBC-TNT-002 | Tenant | Check tenant isolation |
| MBC-IMP-001 | Import | Validate CSV format |
| MBC-IMP-002 | Import | Check S3 permissions |

---

## Debugging Workflows

### 1. Command Publishing Issues

**Symptom:** Command not being processed

**Debug Steps:**
```typescript
// Step 1: Enable verbose logging
const logger = new Logger('CommandDebug');

// Step 2: Log the command before publishing
logger.debug('Publishing command:', JSON.stringify(command, null, 2));

// Step 3: Wrap in try-catch with detailed logging
try {
  const result = await this.commandService.publishAsync(command, {
    source: commandSource,
    invokeContext,
  });
  logger.debug('Command result:', JSON.stringify(result, null, 2));
  return result;
} catch (error) {
  logger.error('Command failed:', {
    error: error.message,
    name: error.name,
    command: { pk: command.pk, sk: command.sk, type: command.type },
  });
  throw error;
}
```

**Common Causes:**
1. Missing required fields (pk, sk, type, version)
2. Invalid pk/sk format
3. Version mismatch (optimistic locking failure)
4. DataSyncHandler not registered

---

### 2. ConditionalCheckFailedException

**Symptom:** Version conflict error

**Debug Steps:**
```typescript
// Step 1: Check current version
const existing = await this.dataService.getItem({ pk, sk });
console.log('Current version:', existing.version);

// Step 2: Compare with command version
console.log('Command version:', command.version);

// Step 3: Investigate concurrent modifications
// Check CloudWatch logs for other requests modifying the same item
```

**Solution:**
```typescript
// Always fetch the latest version before updating
async update(key: DetailKey, dto: UpdateDto, invokeContext: IInvoke) {
  // Retry logic for version conflicts
  const maxRetries = 3;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      const existing = await this.dataService.getItem(key);

      return await this.commandService.publishPartialUpdateAsync({
        pk: key.pk,
        sk: key.sk,
        version: existing.version, // Always use latest version
        ...dto,
      }, { source: commandSource, invokeContext });
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        retries++;
        if (retries >= maxRetries) {
          throw new ConflictException('Too many concurrent modifications');
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 100 * retries));
        continue;
      }
      throw error;
    }
  }
}
```

---

### 3. DataSyncHandler Not Triggering

**Symptom:** Data not syncing to RDS/Elasticsearch

**Debug Checklist:**
```
□ Handler is decorated with @DataSyncHandler({ type: 'ENTITY' })
□ Type matches the command's type field exactly
□ Handler is registered in module's dataSyncHandlers array
□ Handler implements IDataSyncHandler interface
□ up() method is async and properly awaited
```

**Debug Steps:**
```typescript
// Step 1: Add logging to handler
@DataSyncHandler({ type: 'ORDER' })
export class OrderDataSyncRdsHandler implements IDataSyncHandler {
  private readonly logger = new Logger(OrderDataSyncRdsHandler.name);

  async up(cmd: CommandModel, data: DataModel): Promise<void> {
    this.logger.log(`DataSync triggered for ${data.id}`);
    this.logger.debug('Command:', JSON.stringify(cmd, null, 2));
    this.logger.debug('Data:', JSON.stringify(data, null, 2));

    // Your sync logic
  }
}

// Step 2: Verify type matching
// In your command:
const command = new OrderCommandDto({
  type: 'ORDER', // Must match @DataSyncHandler({ type: 'ORDER' })
});

// Step 3: Check module registration
CommandModule.register({
  tableName: 'order',
  dataSyncHandlers: [OrderDataSyncRdsHandler], // Must be included!
}),
```

---

### 4. Tenant Isolation Issues

**Symptom:** Cross-tenant data leakage or access denied

**Debug Steps:**
```typescript
// Step 1: Log tenant context
const { tenantCode, userId } = getUserContext(invokeContext);
console.log('Tenant context:', { tenantCode, userId });

// Step 2: Verify PK includes tenant code
const pk = `ORDER#${tenantCode}`;
console.log('Generated PK:', pk);

// Step 3: Check data query includes tenant filter
const results = await this.dataService.listByPk({
  pk: `ORDER#${tenantCode}`, // Tenant-scoped query
});
```

**Common Causes:**
1. Missing tenantCode in pk
2. Not calling getUserContext()
3. Hardcoded pk without tenant scope
4. Direct DynamoDB access bypassing tenant filter

---

### 5. Import Processing Issues

**Symptom:** Import job fails or gets stuck

**Debug Checklist:**
```
□ CSV file format is valid
□ S3 bucket permissions are correct
□ Step Functions execution has proper IAM role
□ Lambda timeout is sufficient
□ Memory allocation is adequate
```

**Debug Steps:**
```typescript
// Step 1: Check Step Functions execution
// AWS Console → Step Functions → Executions → View details

// Step 2: Check Lambda logs
// AWS Console → CloudWatch → Log groups → /aws/lambda/import-handler

// Step 3: Validate CSV format locally
import * as csv from 'csv-parse';

const validateCsv = async (filePath: string) => {
  const parser = fs.createReadStream(filePath).pipe(csv.parse({
    columns: true,
    skip_empty_lines: true,
  }));

  let rowCount = 0;
  const errors: string[] = [];

  for await (const row of parser) {
    rowCount++;
    // Validate required fields
    if (!row.code) errors.push(`Row ${rowCount}: missing code`);
    if (!row.name) errors.push(`Row ${rowCount}: missing name`);
  }

  return { rowCount, errors };
};
```

---

### 6. Performance Issues

**Symptom:** Slow API responses

**Debug Areas:**

#### DynamoDB Query Optimization
```typescript
// Bad: Scanning entire table
const results = await this.dataService.scan(); // Avoid!

// Good: Query by partition key
const results = await this.dataService.listByPk({
  pk: `ORDER#${tenantCode}`,
  limit: 20,
});

// Better: Add GSI for common queries
// Check if GSI exists for your query pattern
```

#### N+1 Query Problem
```typescript
// Bad: N+1 queries
const orders = await this.dataService.listByPk({ pk });
for (const order of orders) {
  const customer = await this.customerService.findOne(order.customerId); // N queries!
}

// Good: Batch fetch
const orders = await this.dataService.listByPk({ pk });
const customerIds = [...new Set(orders.map(o => o.customerId))];
const customers = await this.customerService.findByIds(customerIds); // 1 query
const customerMap = new Map(customers.map(c => [c.id, c]));
```

#### Cold Start Optimization
```typescript
// Enable provisioned concurrency for critical functions
// serverless.yml
functions:
  api:
    handler: dist/lambda.handler
    provisionedConcurrency: 2
```

---

## CloudWatch Log Queries

### Find Errors by Request ID
```sql
fields @timestamp, @message
| filter @requestId = "REQUEST_ID_HERE"
| sort @timestamp asc
```

### Find ConditionalCheckFailedException
```sql
fields @timestamp, @message
| filter @message like /ConditionalCheckFailedException/
| sort @timestamp desc
| limit 100
```

### Find Slow Requests
```sql
fields @timestamp, @duration, @message
| filter @duration > 3000
| sort @duration desc
| limit 50
```

### Find DataSyncHandler Executions
```sql
fields @timestamp, @message
| filter @message like /DataSync/
| sort @timestamp desc
| limit 100
```

---

## Local Development Debugging

### LocalStack Issues

**Start LocalStack:**
```bash
docker-compose up -d localstack
```

**Verify Services:**
```bash
# Check DynamoDB
aws --endpoint-url=http://localhost:4566 dynamodb list-tables

# Check S3
aws --endpoint-url=http://localhost:4566 s3 ls

# Check SQS
aws --endpoint-url=http://localhost:4566 sqs list-queues
```

### Serverless Offline Debug

```bash
# Start with debug logging
DEBUG=* npm run offline

# Or enable specific debug namespaces
DEBUG=serverless:* npm run offline
```

### VS Code Debug Configuration

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Serverless Offline",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "offline"],
      "port": 9229,
      "restart": true,
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

---

## Diagnostic Commands

### Check Package Versions
```bash
npm list @mbc-cqrs-serverless/core
npm list @mbc-cqrs-serverless/cli
```

### Verify DynamoDB Table Schema
```bash
aws dynamodb describe-table --table-name YOUR_TABLE_NAME
```

### Check Lambda Configuration
```bash
aws lambda get-function-configuration --function-name YOUR_FUNCTION_NAME
```

### View Recent CloudWatch Logs
```bash
aws logs tail /aws/lambda/YOUR_FUNCTION_NAME --since 1h
```

---

## Troubleshooting Decision Tree

```
Error Occurred
│
├── Is it a TypeScript compilation error?
│   └── Check import statements and type definitions
│
├── Is it a runtime error?
│   ├── ConditionalCheckFailedException?
│   │   └── Version mismatch - fetch latest version
│   │
│   ├── ResourceNotFoundException?
│   │   └── Table/Item doesn't exist - check table name
│   │
│   ├── ValidationError?
│   │   └── Check DTO validation decorators
│   │
│   └── Unknown error?
│       └── Check CloudWatch logs for stack trace
│
├── Is it a silent failure?
│   ├── DataSyncHandler not running?
│   │   └── Check type matching and registration
│   │
│   ├── Event not received?
│   │   └── Check SNS/SQS configuration
│   │
│   └── Command not processing?
│       └── Check Lambda invocation and DLQ
│
└── Is it a performance issue?
    ├── Cold start?
    │   └── Enable provisioned concurrency
    │
    ├── Slow queries?
    │   └── Add GSI or optimize query pattern
    │
    └── Memory issues?
        └── Increase Lambda memory allocation
```

---

## Getting Help

When reporting issues, include:

1. **Error message** and stack trace
2. **MBC CQRS Serverless version** (`npm list @mbc-cqrs-serverless/core`)
3. **Node.js version** (`node --version`)
4. **Relevant code snippets**
5. **CloudWatch log excerpts**
6. **Steps to reproduce**

Resources:
- [Error Catalog](/docs/error-catalog)
- [FAQ](/docs/faq)
- [GitHub Issues](https://github.com/mbc-net/mbc-cqrs-serverless/issues)
