![MBC CQRS serverless framework](https://mbc-cqrs-serverless.mbc-net.com/img/mbc-cqrs-serverless.png)

# MBC CQRS Serverless Framework - Tenant Package

## Description

The Tenant package provides multi-tenancy support for CQRS applications. It manages:

- **Tenant Management**: Create, update, and manage tenant entities
- **Tenant Groups**: Organize tenants into logical groups
- **Tenant Isolation**: Automatic data isolation between tenants
- **Tenant Settings**: Tenant-specific configuration management

## Installation

```bash
npm install @mbc-cqrs-serverless/tenant
```

## Usage

### Basic Setup

Import and configure the tenant module:

```typescript
import { TenantModule } from '@mbc-cqrs-serverless/tenant';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    TenantModule.register({
      tableName: 'your-tenant-table',
    }),
  ],
})
export class AppModule {}
```

### Tenant Operations

#### Create Tenant

```typescript
import { TenantService } from '@mbc-cqrs-serverless/tenant';

@Injectable()
export class MyTenantService {
  constructor(private readonly tenantService: TenantService) {}

  async createTenant(data: CreateTenantDto) {
    return this.tenantService.create({
      code: 'TENANT001',
      name: 'Acme Corporation',
      description: 'Enterprise customer',
      attributes: {
        plan: 'enterprise',
        maxUsers: 100,
      },
    });
  }
}
```

#### Get Tenant

```typescript
async getTenant(tenantCode: string) {
  return this.tenantService.findByCode(tenantCode);
}

async getAllTenants() {
  return this.tenantService.findAll();
}
```

#### Update Tenant

```typescript
async updateTenant(tenantCode: string, data: UpdateTenantDto) {
  return this.tenantService.update(tenantCode, {
    name: data.name,
    attributes: data.attributes,
  });
}
```

#### Delete Tenant

```typescript
async deleteTenant(tenantCode: string) {
  return this.tenantService.delete(tenantCode);
}
```

### Tenant Groups

Organize tenants into groups for easier management:

#### Create Tenant Group

```typescript
async createTenantGroup(data: CreateGroupDto) {
  return this.tenantService.createGroup({
    code: 'ENTERPRISE',
    name: 'Enterprise Customers',
    tenantCodes: ['TENANT001', 'TENANT002'],
  });
}
```

#### Add Tenant to Group

```typescript
async addTenantToGroup(groupCode: string, tenantCode: string) {
  return this.tenantService.addToGroup({
    groupCode,
    tenantCode,
  });
}
```

#### Update Tenant Group

```typescript
async updateTenantGroup(groupCode: string, data: UpdateGroupDto) {
  return this.tenantService.updateGroup(groupCode, {
    name: data.name,
    tenantCodes: data.tenantCodes,
  });
}
```

### Tenant Context

Access current tenant in your services:

```typescript
import { TenantContext, InjectTenantContext } from '@mbc-cqrs-serverless/tenant';

@Injectable()
export class OrderService {
  constructor(
    @InjectTenantContext() private readonly tenantContext: TenantContext
  ) {}

  async createOrder(data: CreateOrderDto) {
    const tenantCode = this.tenantContext.getTenantCode();
    // Order is automatically associated with current tenant
    return this.orderRepository.create({
      tenantCode,
      ...data,
    });
  }
}
```

### Common Tenant

Create a common tenant for shared data:

```typescript
async createCommonTenant() {
  return this.tenantService.createCommonTenant({
    name: 'Common',
    description: 'Shared data across all tenants',
  });
}
```

## API Reference

### TenantService

| Method | Description |
|--------|-------------|
| `create(dto)` | Create new tenant |
| `update(code, dto)` | Update tenant |
| `delete(code)` | Delete tenant |
| `findByCode(code)` | Find tenant by code |
| `findAll()` | Get all tenants |
| `createGroup(dto)` | Create tenant group |
| `updateGroup(code, dto)` | Update tenant group |
| `addToGroup(dto)` | Add tenant to group |
| `removeFromGroup(dto)` | Remove tenant from group |

### TenantContext

| Method | Description |
|--------|-------------|
| `getTenantCode()` | Get current tenant code |
| `getTenant()` | Get current tenant entity |
| `isCommonTenant()` | Check if common tenant |

## Tenant Data Structure

```typescript
interface Tenant {
  pk: string;           // Partition key
  sk: string;           // Sort key
  code: string;         // Unique tenant code
  name: string;         // Display name
  description?: string; // Optional description
  attributes?: Record<string, any>; // Custom attributes
  createdAt: string;    // Creation timestamp
  updatedAt: string;    // Last update timestamp
}
```

## Documentation

Visit https://mbc-cqrs-serverless.mbc-net.com/ to view the full documentation.

## License

Copyright &copy; 2024, Murakami Business Consulting, Inc. https://www.mbc-net.com/
This project and sub projects are under the MIT License.
