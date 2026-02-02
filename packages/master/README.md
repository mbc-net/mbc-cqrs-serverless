![MBC CQRS serverless framework](https://mbc-cqrs-serverless.mbc-net.com/img/mbc-cqrs-serverless.png)

# @mbc-cqrs-serverless/master

[![npm version](https://badge.fury.io/js/@mbc-cqrs-serverless%2Fmaster.svg)](https://www.npmjs.com/package/@mbc-cqrs-serverless/master)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Master data and hierarchical settings management for the MBC CQRS Serverless framework. Manage reference data, configuration settings, and multi-level overrides with automatic RDS synchronization.

## Features

- **Master Data Management**: CRUD operations for reference data (products, categories, etc.)
- **Hierarchical Settings**: 4-level setting inheritance (Common → Tenant → Group → User)
- **RDS Integration**: Automatic sync to relational database for complex queries
- **Multi-tenant**: Isolated master data per tenant
- **Bulk Operations**: Create multiple records in a single request
- **Copy Settings**: Replicate settings across tenants

## Installation

```bash
npm install @mbc-cqrs-serverless/master
```

## Quick Start

### 1. Register the Module

```typescript
import { Module } from '@nestjs/common';
import { MasterModule } from '@mbc-cqrs-serverless/master';
import { PrismaService } from './prisma/prisma.service';
import { MasterDataSyncHandler } from './handlers/master-data-sync.handler';

@Module({
  imports: [
    MasterModule.register({
      enableController: true, // Optional: enable REST endpoints
      prismaService: PrismaService, // Required when enableController is true
      dataSyncHandlers: [MasterDataSyncHandler], // Optional: custom sync handlers
    }),
  ],
})
export class AppModule {}
```

### 2. Use Master Data Service

```typescript
import { Injectable } from '@nestjs/common';
import { MasterDataService } from '@mbc-cqrs-serverless/master';
import { IInvoke } from '@mbc-cqrs-serverless/core';

@Injectable()
export class ProductService {
  constructor(private readonly masterDataService: MasterDataService) {}

  async createProduct(data: any, opts: { invokeContext: IInvoke }) {
    return this.masterDataService.create(
      {
        tenantCode: 'MBC',
        settingCode: 'PRODUCT',
        code: 'PROD-001',
        name: data.name,
        attributes: { price: data.price, category: data.category },
      },
      opts,
    );
  }
}
```

## API Reference

### MasterDataService

Service for managing master data records.

| Method | Description |
|--------|-------------|
| `create(dto, options)` | Create new master data |
| `createSetting(dto, invokeContext)` | Create with auto-generated seq |
| `createBulk(dto, invokeContext)` | Create multiple records |
| `update(key, dto, options)` | Update master data |
| `updateSetting(key, dto, invokeContext)` | Update with simplified params |
| `delete(key, options)` | Soft delete master data |
| `deleteSetting(key, invokeContext)` | Delete with simplified params |
| `get(key)` | Get single record by pk/sk |
| `getDetail(key)` | Get record with RDS entity format |
| `list(searchDto)` | List by DynamoDB query |
| `listByRds(searchDto, context)` | List with RDS full-text search |
| `checkExistCode(tenantCode, type, code)` | Check if code exists |

### MasterSettingService

Service for managing hierarchical settings.

| Method | Description |
|--------|-------------|
| `getSetting(dto, options)` | Get effective setting (auto-resolves hierarchy) |
| `createCommonTenantSetting(dto, options)` | Create common-level setting |
| `createTenantSetting(dto, options)` | Create tenant-level setting |
| `createGroupSetting(dto, options)` | Create group-level setting |
| `createUserSetting(dto, options)` | Create user-level setting |
| `updateSetting(key, dto, options)` | Update existing setting |
| `deleteSetting(key, options)` | Soft delete setting |
| `copy(dto, options)` | Copy settings to other tenants |
| `list(searchDto, invokeContext)` | List settings with search |

## Setting Hierarchy

Settings are resolved in order of specificity (most specific wins):

```
1. User Setting     (SETTING#TENANT_USER#userId#code)
         ↓ if not found
2. Group Setting    (SETTING#TENANT_GROUP#groupId#code)
         ↓ if not found
3. Tenant Setting   (SETTING#code)
         ↓ if not found
4. Common Setting   (pk: SETTING#common)
```

### Example: Theme Setting

```typescript
// 1. Create common default (all tenants)
await masterSettingService.createCommonTenantSetting({
  code: 'THEME',
  name: 'UI Theme',
  settingValue: { primaryColor: '#007bff', mode: 'light' },
}, opts);

// 2. Override for specific tenant
await masterSettingService.createTenantSetting({
  tenantCode: 'COMPANY_A',
  code: 'THEME',
  name: 'UI Theme',
  settingValue: { primaryColor: '#ff0000', mode: 'light' },
}, opts);

// 3. Override for admin group
await masterSettingService.createGroupSetting({
  tenantCode: 'COMPANY_A',
  groupId: 'ADMIN',
  code: 'THEME',
  name: 'UI Theme',
  settingValue: { primaryColor: '#ff0000', mode: 'dark' },
}, opts);

// 4. Override for specific user
await masterSettingService.createUserSetting({
  tenantCode: 'COMPANY_A',
  userId: 'user-123',
  code: 'THEME',
  name: 'UI Theme',
  settingValue: { primaryColor: '#00ff00', mode: 'dark' },
}, opts);

// Get effective setting (resolves automatically)
const theme = await masterSettingService.getSetting({ code: 'THEME' }, opts);
// Returns user setting if exists, otherwise group → tenant → common
```

## Usage Examples

### Master Data CRUD

```typescript
@Injectable()
export class CategoryService {
  constructor(private readonly masterDataService: MasterDataService) {}

  // Create
  async create(dto: CreateCategoryDto, invokeContext: IInvoke) {
    return this.masterDataService.createSetting(
      {
        settingCode: 'CATEGORY',
        name: dto.name,
        attributes: { description: dto.description },
      },
      invokeContext,
    );
  }

  // Update
  async update(pk: string, sk: string, dto: UpdateCategoryDto, invokeContext: IInvoke) {
    return this.masterDataService.updateSetting(
      { pk, sk },
      { name: dto.name, attributes: dto.attributes },
      invokeContext,
    );
  }

  // Delete (soft delete)
  async delete(pk: string, sk: string, invokeContext: IInvoke) {
    return this.masterDataService.deleteSetting({ pk, sk }, invokeContext);
  }

  // Search with RDS
  async search(keyword: string, invokeContext: IInvoke) {
    return this.masterDataService.listByRds(
      {
        keyword,
        settingCode: 'CATEGORY',
        page: 1,
        pageSize: 20,
      },
      { invokeContext },
    );
  }
}
```

### Bulk Creation

```typescript
async createCategories(categories: CreateCategoryDto[], invokeContext: IInvoke) {
  return this.masterDataService.createBulk(
    {
      items: categories.map((cat) => ({
        settingCode: 'CATEGORY',
        name: cat.name,
        attributes: cat.attributes,
      })),
    },
    invokeContext,
  );
}
```

### Copy Settings Across Tenants

```typescript
async copySettingsToNewTenant(settingId: string, targetTenants: string[], opts: { invokeContext: IInvoke }) {
  return this.masterSettingService.copy(
    {
      masterSettingId: settingId,
      targetTenants,
      dataCopyOption: { mode: DataCopyMode.ALL },
    },
    opts,
  );
}
```

## Data Model

### Master Data Key Pattern

```
pk: MASTER#[tenantCode]
sk: DATA#[settingCode]#[code]
```

### Master Setting Key Pattern

```
pk: SETTING#[tenantCode] or SETTING#common
sk: SETTING#[code]                           (tenant/common)
    SETTING#TENANT_GROUP#[groupId]#[code]    (group)
    SETTING#TENANT_USER#[userId]#[code]      (user)
```

## Related Packages

| Package | Description |
|---------|-------------|
| [@mbc-cqrs-serverless/core](https://www.npmjs.com/package/@mbc-cqrs-serverless/core) | Core CQRS framework |
| [@mbc-cqrs-serverless/sequence](https://www.npmjs.com/package/@mbc-cqrs-serverless/sequence) | Uses master data for sequence formats |
| [@mbc-cqrs-serverless/tenant](https://www.npmjs.com/package/@mbc-cqrs-serverless/tenant) | Tenant management for group settings |

## Documentation

Full documentation available at [https://mbc-cqrs-serverless.mbc-net.com/](https://mbc-cqrs-serverless.mbc-net.com/)

- [Master Service Guide](https://mbc-cqrs-serverless.mbc-net.com/docs/master-service)

## License

Copyright © 2024-2025, Murakami Business Consulting, Inc. [https://www.mbc-net.com/](https://www.mbc-net.com/)

This project is under the [MIT License](../../LICENSE.txt).
