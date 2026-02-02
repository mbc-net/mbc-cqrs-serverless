![MBC CQRS serverless framework](https://mbc-cqrs-serverless.mbc-net.com/img/mbc-cqrs-serverless.png)

# @mbc-cqrs-serverless/tenant

[![npm version](https://badge.fury.io/js/@mbc-cqrs-serverless%2Ftenant.svg)](https://www.npmjs.com/package/@mbc-cqrs-serverless/tenant)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Multi-tenancy support for the MBC CQRS Serverless framework. Manage tenants, tenant groups, and role-based setting group assignments for enterprise SaaS applications.

## Features

- **Tenant Management**: Create, update, and manage tenant entities
- **Tenant Groups**: Organize related entities within tenants
- **Role-Based Settings**: Assign setting groups to user roles within tenants
- **Common Tenant**: Shared configuration across all tenants
- **Tenant Isolation**: Automatic data isolation between tenants

## Installation

```bash
npm install @mbc-cqrs-serverless/tenant
```

## Quick Start

### 1. Register the Module

```typescript
import { Module } from '@nestjs/common';
import { TenantModule } from '@mbc-cqrs-serverless/tenant';
import { TenantDataSyncHandler } from './handlers/tenant-data-sync.handler';

@Module({
  imports: [
    TenantModule.register({
      enableController: true, // Optional: enable REST endpoints
      dataSyncHandlers: [TenantDataSyncHandler], // Optional: custom sync handlers
    }),
  ],
})
export class AppModule {}
```

### 2. Use the Tenant Service

```typescript
import { Injectable } from '@nestjs/common';
import { TenantService } from '@mbc-cqrs-serverless/tenant';
import { IInvoke } from '@mbc-cqrs-serverless/core';

@Injectable()
export class MyService {
  constructor(private readonly tenantService: TenantService) {}

  async createTenant(data: any, opts: { invokeContext: IInvoke }) {
    return this.tenantService.createTenant(
      {
        code: 'ACME',
        name: 'Acme Corporation',
        attributes: { plan: 'enterprise', maxUsers: 100 },
      },
      opts,
    );
  }
}
```

## API Reference

### TenantService

| Method | Description |
|--------|-------------|
| `createTenant(dto, context)` | Create a new tenant |
| `createCommonTenant(dto, context)` | Create the shared common tenant |
| `updateTenant(key, dto, context)` | Update tenant properties |
| `deleteTenant(key, context)` | Soft delete a tenant |
| `getTenant(key)` | Get tenant by pk/sk |
| `createTenantGroup(tenantGroupCode, dto, context)` | Create a tenant within a tenant group |
| `addTenantGroup(dto, context)` | Add a group to tenant role settings |
| `customizeSettingGroups(dto, context)` | Customize setting group order for a role |

### TenantCreateDto

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `code` | string | Yes | Unique tenant identifier |
| `name` | string | Yes | Display name |
| `attributes` | object | No | Custom tenant properties |

### TenantGroupAddDto

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `tenantCode` | string | Yes | Target tenant |
| `role` | string | Yes | User role to configure |
| `groupId` | string | Yes | Group to add to role settings |

## Usage Examples

### Create Common Tenant

Create a shared tenant for common settings:

```typescript
async createCommonTenant(opts: { invokeContext: IInvoke }) {
  return this.tenantService.createCommonTenant(
    {
      name: 'Common Settings',
      attributes: { description: 'Shared across all tenants' },
    },
    opts,
  );
}
```

### Create Tenant

```typescript
async createTenant(dto: CreateTenantDto, opts: { invokeContext: IInvoke }) {
  return this.tenantService.createTenant(
    {
      code: dto.code,
      name: dto.name,
      attributes: {
        plan: dto.plan,
        maxUsers: dto.maxUsers,
        features: dto.features,
      },
    },
    opts,
  );
}
```

### Update Tenant

```typescript
async updateTenant(
  tenantCode: string,
  dto: UpdateTenantDto,
  opts: { invokeContext: IInvoke },
) {
  const pk = `TENANT#${tenantCode}`;
  const sk = 'TENANT';

  return this.tenantService.updateTenant(
    { pk, sk },
    { name: dto.name, attributes: dto.attributes },
    opts,
  );
}
```

### Delete Tenant (Soft Delete)

```typescript
async deleteTenant(tenantCode: string, opts: { invokeContext: IInvoke }) {
  const pk = `TENANT#${tenantCode}`;
  const sk = 'TENANT';

  return this.tenantService.deleteTenant({ pk, sk }, opts);
}
```

### Role-Based Setting Groups

Configure which setting groups apply to different user roles:

```typescript
// Add a group to admin role settings
async addGroupToAdminRole(tenantCode: string, groupId: string, opts: { invokeContext: IInvoke }) {
  return this.tenantService.addTenantGroup(
    {
      tenantCode,
      role: 'admin',
      groupId,
    },
    opts,
  );
}

// Customize the order of setting groups for a role
async customizeRoleSettings(
  tenantCode: string,
  role: string,
  settingGroups: string[],
  opts: { invokeContext: IInvoke },
) {
  return this.tenantService.customizeSettingGroups(
    {
      tenantCode,
      role,
      settingGroups, // Ordered list of group IDs
    },
    opts,
  );
}
```

### Create Tenant Group

Create a tenant entity within a specific tenant group:

```typescript
async createDepartment(
  tenantGroupCode: string,
  dto: CreateDepartmentDto,
  opts: { invokeContext: IInvoke },
) {
  return this.tenantService.createTenantGroup(
    tenantGroupCode,
    {
      code: dto.code,
      name: dto.name,
      attributes: dto.attributes,
    },
    opts,
  );
}
```

## Data Model

### Tenant Key Pattern

```
pk: TENANT#[tenantCode]
sk: TENANT

Example:
pk: TENANT#ACME
sk: TENANT
```

### Tenant Group Key Pattern

```
pk: TENANT#[tenantCode]
sk: [groupCode]

Example:
pk: TENANT#ACME
sk: SALES_DEPT
```

### Setting Groups Structure

Role-based setting groups are stored in tenant attributes:

```json
{
  "pk": "TENANT#ACME",
  "sk": "TENANT",
  "attributes": {
    "setting": [
      {
        "tenantRole": "admin",
        "groups": ["GROUP#ADMIN", "GROUP#POWER_USER"],
        "setting_groups": ["GROUP#ADMIN", "GROUP#POWER_USER"],
        "setting_groups_mode": "auto"
      },
      {
        "tenantRole": "user",
        "groups": ["GROUP#USER"],
        "setting_groups": ["GROUP#USER"],
        "setting_groups_mode": "customized"
      }
    ]
  }
}
```

## Related Packages

| Package | Description |
|---------|-------------|
| [@mbc-cqrs-serverless/core](https://www.npmjs.com/package/@mbc-cqrs-serverless/core) | Core CQRS framework |
| [@mbc-cqrs-serverless/master](https://www.npmjs.com/package/@mbc-cqrs-serverless/master) | Hierarchical settings with tenant support |

## Documentation

Full documentation available at [https://mbc-cqrs-serverless.mbc-net.com/](https://mbc-cqrs-serverless.mbc-net.com/)

- [Tenant Service Guide](https://mbc-cqrs-serverless.mbc-net.com/docs/tenant-service)

## License

Copyright © 2024-2025, Murakami Business Consulting, Inc. [https://www.mbc-net.com/](https://www.mbc-net.com/)

This project is under the [MIT License](../../LICENSE.txt).
