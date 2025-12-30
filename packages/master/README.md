![MBC CQRS serverless framework](https://mbc-cqrs-serverless.mbc-net.com/img/mbc-cqrs-serverless.png)

# MBC CQRS Serverless Framework - Master Package

## Description

The Master package provides master data and hierarchical settings management for multi-tenant CQRS applications. It offers:

- **Master Data Service**: CRUD operations for master data entities with tenant isolation
- **Master Setting Service**: Hierarchical settings across user, group, tenant, and common levels
- **Master Copy Service**: Synchronization with RDS for complex queries

## Installation

```bash
npm install @mbc-cqrs-serverless/master
```

## Usage

### Basic Setup

Import and configure the master module in your application:

```typescript
import { MasterModule } from '@mbc-cqrs-serverless/master';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    MasterModule.register({
      tableName: 'your-master-table',
    }),
  ],
})
export class AppModule {}
```

### Master Data Operations

#### Create Master Data

```typescript
import { MasterDataService } from '@mbc-cqrs-serverless/master';

@Injectable()
export class ProductService {
  constructor(private readonly masterDataService: MasterDataService) {}

  async createProduct(data: CreateProductDto) {
    return this.masterDataService.create({
      tenantCode: 'TENANT001',
      typeCode: 'PRODUCT',
      code: 'PROD-001',
      name: data.name,
      attributes: data.attributes,
    });
  }
}
```

#### Query Master Data

```typescript
async getProducts(tenantCode: string) {
  return this.masterDataService.search({
    tenantCode,
    typeCode: 'PRODUCT',
  });
}

async getProductByCode(tenantCode: string, code: string) {
  return this.masterDataService.findByCode({
    tenantCode,
    typeCode: 'PRODUCT',
    code,
  });
}
```

#### Update Master Data

```typescript
async updateProduct(id: string, data: UpdateProductDto) {
  return this.masterDataService.update(id, {
    name: data.name,
    attributes: data.attributes,
  });
}
```

### Hierarchical Settings

The setting service supports four hierarchy levels (highest to lowest priority):

1. **User Level**: Settings specific to individual users
2. **Group Level**: Settings for user groups
3. **Tenant Level**: Settings for entire tenant
4. **Common Level**: Default settings for all tenants

#### Create Settings

```typescript
import { MasterSettingService } from '@mbc-cqrs-serverless/master';

@Injectable()
export class SettingService {
  constructor(private readonly settingService: MasterSettingService) {}

  // Common setting (applies to all)
  async createCommonSetting(key: string, value: any) {
    return this.settingService.createCommonSetting({
      settingCode: key,
      value,
    });
  }

  // Tenant-specific setting
  async createTenantSetting(tenantCode: string, key: string, value: any) {
    return this.settingService.createTenantSetting({
      tenantCode,
      settingCode: key,
      value,
    });
  }

  // User-specific setting
  async createUserSetting(userId: string, key: string, value: any) {
    return this.settingService.createUserSetting({
      userId,
      settingCode: key,
      value,
    });
  }
}
```

#### Get Effective Setting

The service automatically resolves the most specific setting:

```typescript
async getEffectiveSetting(userId: string, tenantCode: string, key: string) {
  // Returns user setting if exists, otherwise group, tenant, or common
  return this.settingService.getSetting({
    userId,
    tenantCode,
    settingCode: key,
  });
}
```

### RDS Synchronization

For complex queries, sync master data to RDS:

```typescript
import { MasterCopyService } from '@mbc-cqrs-serverless/master';

@Injectable()
export class SyncService {
  constructor(private readonly masterCopyService: MasterCopyService) {}

  async syncToRds(tenantCode: string) {
    return this.masterCopyService.syncMasterData({
      tenantCode,
      typeCode: 'PRODUCT',
    });
  }
}
```

## API Reference

### MasterDataService

| Method | Description |
|--------|-------------|
| `create(dto)` | Create new master data |
| `update(id, dto)` | Update existing master data |
| `delete(id)` | Delete master data |
| `findByCode(params)` | Find by tenant, type, and code |
| `search(params)` | Search with filters |

### MasterSettingService

| Method | Description |
|--------|-------------|
| `createCommonSetting(dto)` | Create common-level setting |
| `createTenantSetting(dto)` | Create tenant-level setting |
| `createGroupSetting(dto)` | Create group-level setting |
| `createUserSetting(dto)` | Create user-level setting |
| `getSetting(params)` | Get effective setting value |
| `updateSetting(id, dto)` | Update existing setting |

## Documentation

Visit https://mbc-cqrs-serverless.mbc-net.com/ to view the full documentation.

## License

Copyright &copy; 2024, Murakami Business Consulting, Inc. https://www.mbc-net.com/
This project and sub projects are under the MIT License.
