# MBC CQRS Serverless Framework Testing Guide

This guide explains how to create and run tests for applications built with the MBC CQRS Serverless Framework.

## Table of Contents
1. [Overview](#overview)
2. [Test Types](#test-types)
3. [E2E Testing](#e2e-testing)
4. [Versioning Rules](#versioning-rules)
5. [Sample Implementations](#sample-implementations)

## Overview

The MBC CQRS Serverless Framework provides comprehensive testing capabilities for your CQRS applications. This includes unit tests, integration tests, and end-to-end (E2E) tests.

## Test Types

### Unit Tests
- Test individual components in isolation
- Located in `__tests__` directories alongside source files
- Use Jest as the testing framework

### Integration Tests
- Test interaction between multiple components
- Located in `test/integration` directory
- Focus on testing service integrations

### E2E Tests
- Test complete features end-to-end
- Located in `test/e2e` directory
- Test API endpoints and data persistence

## E2E Testing

### Setup
1. Create test files in `test/e2e` directory with `.e2e-spec.ts` extension
2. Use the provided test utilities from `test/e2e/config.ts`
3. Configure test environment variables in `.env.test`

### Best Practices
1. Clean up test data before and after tests
2. Use unique identifiers for test data
3. Follow the Arrange-Act-Assert pattern
4. Include proper error handling
5. Test both success and failure scenarios

## Versioning Rules

The framework implements optimistic locking using version numbers:

1. Items with the same pk/sk combination:
   - Versions must be sequential starting from 1
   - Only the first request with a given version will succeed
   - Subsequent requests with the same version will fail

2. Different pk/sk combinations:
   - Each combination starts its own version sequence from 1
   - Version sequences are independent

### Optimistic Locking
- Used to prevent concurrent updates
- Version number increments with each update
- Throws ConditionalCheckFailedException on version conflicts

## Sample Implementations

### Basic CRUD Test
\`\`\`typescript
describe('CRUD Operations', () => {
  it('should create and retrieve an item', async () => {
    // Arrange
    const payload = {
      pk: 'TEST#CRUD',
      sk: 'item#1',
      id: 'TEST#CRUD#item#1',
      name: 'Test Item',
      version: 0,
      type: 'TEST',
    }

    // Act
    const createRes = await request(config.apiBaseUrl)
      .post('/items')
      .send(payload)

    // Assert
    expect(createRes.statusCode).toBe(201)
    expect(createRes.body.version).toBe(1)

    // Verify retrieval
    const getRes = await request(config.apiBaseUrl)
      .get(\`/items/\${payload.id}\`)
    
    expect(getRes.statusCode).toBe(200)
    expect(getRes.body).toMatchObject({
      ...payload,
      version: 1,
    })
  })
})
\`\`\`

### Version Conflict Test
\`\`\`typescript
describe('Versioning', () => {
  it('should handle version conflicts', async () => {
    // Arrange
    const payload = {
      pk: 'TEST#VERSION',
      sk: 'conflict#1',
      id: 'TEST#VERSION#conflict#1',
      name: 'Version Test',
      version: 1,
      type: 'TEST',
    }

    // Act - First update
    const res1 = await request(config.apiBaseUrl)
      .put(\`/items/\${payload.id}\`)
      .send(payload)

    // Act - Second update with same version
    const res2 = await request(config.apiBaseUrl)
      .put(\`/items/\${payload.id}\`)
      .send(payload)

    // Assert
    expect(res1.statusCode).toBe(200)
    expect(res2.statusCode).toBe(409) // Conflict
  })
})
\`\`\`

### Different PK/SK Version Test
\`\`\`typescript
describe('Independent Versioning', () => {
  it('should maintain independent version sequences', async () => {
    // Arrange
    const item1 = {
      pk: 'TEST#SEQ1',
      sk: 'item#1',
      id: 'TEST#SEQ1#item#1',
      name: 'Sequence 1',
      version: 0,
      type: 'TEST',
    }

    const item2 = {
      pk: 'TEST#SEQ2',
      sk: 'item#1',
      id: 'TEST#SEQ2#item#1',
      name: 'Sequence 2',
      version: 0,
      type: 'TEST',
    }

    // Act
    const res1 = await request(config.apiBaseUrl)
      .post('/items')
      .send(item1)

    const res2 = await request(config.apiBaseUrl)
      .post('/items')
      .send(item2)

    // Assert
    expect(res1.body.version).toBe(1)
    expect(res2.body.version).toBe(1)
  })
})
\`\`\`
