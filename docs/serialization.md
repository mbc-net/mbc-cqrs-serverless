# Serialization Helpers

## Overview
The MBC CQRS Serverless Framework provides helper functions for converting between internal DynamoDB structures and external flat structures. These helpers ensure consistent data transformation while maintaining type safety.

## Data Structure Conversion

### Internal DynamoDB Structure
```typescript
{
  pk: "PROJECT",
  sk: "123",
  name: "Test Project",
  attributes: {
    details: {
      status: "active",
      category: "development"
    }
  }
}
```

### External Flat Structure
```typescript
{
  "id": "PROJECT#123",    // Combination of pk and sk
  "code": "123",         // Mainly sk
  "name": "Test Project", // First level in DynamoDB
  "details": {           // Flattened from attributes
    "status": "active",
    "category": "development"
  }
}
```

## Usage

### Converting Internal to External Format
```typescript
import { serializeToExternal } from '@mbc-cqrs-serverless/core';

const internal = {
  pk: "PROJECT",
  sk: "123",
  name: "Test Project",
  attributes: {
    details: {
      status: "active",
      category: "development"
    }
  }
};

const external = serializeToExternal(internal);
```

### Converting External to Internal Format
```typescript
import { deserializeToInternal, CommandEntity } from '@mbc-cqrs-serverless/core';

const external = {
  id: "PROJECT#123",
  code: "123",
  name: "Test Project",
  details: {
    status: "active",
    category: "development"
  }
};

const internal = deserializeToInternal(external, CommandEntity);
```

## API Reference

### serializeToExternal
```typescript
function serializeToExternal<T extends CommandEntity | DataEntity>(
  item: T | null | undefined,
  options?: SerializerOptions
): Record<string, any> | null
```

Parameters:
- `item`: Internal entity (CommandEntity or DataEntity)
- `options`: Optional serialization options
  - `keepAttributes`: Keep the attributes field in output (default: false)
  - `flattenDepth`: Maximum depth for flattening nested objects (default: unlimited)

Returns:
- Flattened external structure or null if input is null/undefined

### deserializeToInternal
```typescript
function deserializeToInternal<T extends CommandEntity | DataEntity>(
  data: Record<string, any> | null | undefined,
  EntityClass: new () => T
): T | null
```

Parameters:
- `data`: External flat structure
- `EntityClass`: Entity class to instantiate (CommandEntity or DataEntity)

Returns:
- Internal entity instance or null if input is null/undefined

## Field Mapping

### Metadata Fields
| Field | Description |
|-------|-------------|
| id | Primary key |
| cpk | Command table primary key |
| csk | Command table sort key |
| pk | Data table primary key |
| sk | Data table sort key |
| tenantCode | Tenant code |
| type | Entity type (embedded in pk, e.g., "PROJECT") |
| seq | Sort order |
| code | Code (may be used as part of sk) |
| name | Name |
| version | Version number |
| isDeleted | Deletion flag |
| createdBy | Creator's user ID or username |
| createdIp | Creator's IP address |
| createdAt | Creation timestamp |
| updatedBy | Updater's user ID or username (set at creation) |
| updatedIp | Updater's IP address (set at creation) |
| updatedAt | Update timestamp (set at creation) |
| description | Description |
| status | Status (for CQRS processing) |
| dueDate | Used for DynamoDB TTL |

### Serialization Mapping
| Internal Field | External Field | Description |
|---------------|----------------|-------------|
| pk + sk | id | Combined primary key |
| sk | code | Sort key used as code |
| name | name | First level property |
| attributes.* | * | Flattened attributes |
| version | version | Entity version |
| tenantCode | tenantCode | Tenant identifier |
| type | type | Entity type |
