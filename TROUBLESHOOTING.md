# Troubleshooting Guide

This guide covers common issues and their solutions when working with MBC CQRS Serverless.

## Local Development

### LocalStack Not Starting

**Symptom**: LocalStack container fails to start or services are unavailable.

**Solutions**:
1. Ensure Docker is running
2. Check if ports are available (4566, 4571, etc.)
3. Remove old containers: `docker rm -f localstack`
4. Restart LocalStack: `npm run start:localstack`

### DynamoDB Tables Not Created

**Symptom**: "Table not found" errors when running locally.

**Solutions**:
1. Ensure LocalStack is running
2. Run table creation: `npm run ddb:create`
3. Verify tables exist: `aws --endpoint-url=http://localhost:4566 dynamodb list-tables`

### Cognito Authentication Fails Locally

**Symptom**: 401 Unauthorized errors in local development.

**Solutions**:
1. Check `COGNITO_ENDPOINT` in `.env` points to local mock
2. Verify `USER_POOL_ID` and `WEB_CLIENT_ID` are set correctly
3. For testing, you may need to disable auth guards temporarily

## Build Issues

### TypeScript Compilation Errors

**Symptom**: Build fails with TypeScript errors.

**Solutions**:
1. Clear build cache: `npm run clean`
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Rebuild: `npm run build`

### Module Not Found

**Symptom**: "Cannot find module '@mbc-cqrs-serverless/core'" or similar.

**Solutions**:
1. Build all packages: `npm run build`
2. Check package.json dependencies are correct
3. Run `npm install` in project root

### Lerna Bootstrap Issues

**Symptom**: Lerna commands fail or packages not linked.

**Solutions**:
1. Use npm workspaces instead: `npm install` (handles linking)
2. Clear cache: `npm cache clean --force`
3. Remove all node_modules: `npx lerna clean -y && npm install`

## Runtime Errors

### Version Conflict Error

**Symptom**: "Version mismatch" or "Conditional check failed" errors.

**Cause**: Optimistic locking detected concurrent modification.

**Solutions**:
1. Retry the operation with fresh data
2. Implement retry logic with exponential backoff
3. Review if multiple processes are updating the same entity

### Tenant Not Found

**Symptom**: "Tenant not found" or empty tenant context.

**Solutions**:
1. Ensure `x-tenant-code` header is set in requests
2. Verify JWT token contains tenant claim
3. Check TenantModule is imported in AppModule

### SNS/SQS Publishing Fails

**Symptom**: Events not being published or consumed.

**Solutions**:
1. Check SNS_ENDPOINT and SQS_ENDPOINT in `.env`
2. Verify topic/queue exists
3. Check IAM permissions in AWS deployment
4. Review CloudWatch logs for errors

## Testing Issues

### Tests Timeout

**Symptom**: Tests hang or timeout.

**Solutions**:
1. Increase Jest timeout: `jest --testTimeout=30000`
2. Ensure all async operations are awaited
3. Check for unhandled promises
4. Mock external services properly

### AWS SDK Mock Not Working

**Symptom**: Tests make real AWS calls or mocks not applied.

**Solutions**:
1. Reset mocks before each test: `ddbMock.reset()`
2. Ensure mock is created before importing service
3. Use `aws-sdk-client-mock` correctly:

```typescript
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const ddbMock = mockClient(DynamoDBDocumentClient);

beforeEach(() => {
  ddbMock.reset();
});
```

### E2E Tests Fail

**Symptom**: E2E tests fail with connection errors.

**Solutions**:
1. Start LocalStack before running tests
2. Ensure test database is clean
3. Check test configuration in `jest.config.js`

## Deployment Issues

### Lambda Cold Start Slow

**Symptom**: First request takes too long.

**Solutions**:
1. Use provisioned concurrency
2. Reduce bundle size
3. Optimize imports (avoid importing entire packages)
4. Consider Lambda layers for shared dependencies

### API Gateway 502 Error

**Symptom**: "Internal server error" from API Gateway.

**Solutions**:
1. Check Lambda function logs in CloudWatch
2. Verify Lambda timeout is sufficient
3. Check memory allocation
4. Review function code for unhandled exceptions

### DynamoDB Throttling

**Symptom**: "ProvisionedThroughputExceededException" errors.

**Solutions**:
1. Increase read/write capacity
2. Use on-demand capacity mode
3. Implement exponential backoff
4. Review access patterns for hot partitions

## Performance Issues

### Slow Queries

**Symptom**: Data retrieval takes too long.

**Solutions**:
1. Use proper partition key design
2. Add GSI for query patterns
3. Limit result set with pagination
4. Consider caching frequent queries

### High Memory Usage

**Symptom**: Lambda out of memory errors.

**Solutions**:
1. Increase Lambda memory
2. Stream large data sets instead of loading all at once
3. Review for memory leaks
4. Optimize data processing

## Getting Help

If you cannot resolve your issue:

1. Search existing GitHub issues
2. Check the documentation at https://mbc-cqrs-serverless.mbc-net.com/
3. Open a new issue with:
   - Clear description
   - Steps to reproduce
   - Environment details
   - Error messages and logs
