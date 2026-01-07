![MBC CQRS serverless framework](https://mbc-cqrs-serverless.mbc-net.com/img/mbc-cqrs-serverless.png)

# @mbc-cqrs-serverless/ui-setting

[![npm version](https://badge.fury.io/js/@mbc-cqrs-serverless%2Fui-setting.svg)](https://www.npmjs.com/package/@mbc-cqrs-serverless/ui-setting)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

UI configuration management for the MBC CQRS Serverless framework. Manage user interface settings, themes, preferences, and tenant-specific customizations.

## Features

- **Setting Schema Definition**: Define settings with codes and attributes
- **Data Setting Management**: CRUD operations for setting values
- **Multi-tenant Support**: Tenant-isolated UI configurations
- **Validation**: Automatic setting code validation
- **CQRS Integration**: Full event sourcing for setting changes

## Installation

```bash
npm install @mbc-cqrs-serverless/ui-setting
```

## Quick Start

### 1. Register the Module

```typescript
import { Module } from '@nestjs/common';
import { SettingModule } from '@mbc-cqrs-serverless/ui-setting';

@Module({
  imports: [
    SettingModule.register({
      enableSettingController: true, // Optional: enable setting schema REST endpoints
      enableDataController: true, // Optional: enable data setting REST endpoints
    }),
  ],
})
export class AppModule {}
```

### 2. Use the Data Setting Service

```typescript
import { Injectable } from '@nestjs/common';
import { DataSettingService } from '@mbc-cqrs-serverless/ui-setting';
import { IInvoke } from '@mbc-cqrs-serverless/core';

@Injectable()
export class ThemeService {
  constructor(private readonly dataSettingService: DataSettingService) {}

  async createThemePreset(tenantCode: string, data: any, opts: { invokeContext: IInvoke }) {
    return this.dataSettingService.create(
      tenantCode,
      {
        settingCode: 'THEME',
        code: data.code,
        name: data.name,
        attributes: {
          primaryColor: data.primaryColor,
          mode: data.mode,
          fontSize: data.fontSize,
        },
      },
      opts,
    );
  }
}
```

## API Reference

### DataSettingService

Service for managing setting data values.

| Method | Description |
|--------|-------------|
| `create(tenantCode, dto, options)` | Create new setting data |
| `update(key, dto, options)` | Update setting data |
| `delete(key, options)` | Soft delete setting data |
| `get(key)` | Get setting data by pk/sk |
| `list(tenantCode, searchDto)` | List settings by tenant |
| `checkExistCode(tenantCode, settingCode, code)` | Check if code exists |

### SettingService

Service for managing setting schemas.

| Method | Description |
|--------|-------------|
| `create(tenantCode, dto, options)` | Create setting schema |
| `update(key, dto, options)` | Update setting schema |
| `delete(key, options)` | Delete setting schema |
| `get(key)` | Get setting schema |
| `list(tenantCode, searchDto)` | List setting schemas |

### CreateDataSettingDto

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `settingCode` | string | Yes | Parent setting schema code |
| `code` | string | Yes | Unique value code |
| `name` | string | No | Display name |
| `attributes` | object | No | Setting values |

## Usage Examples

### Define Setting Schema

First, create the setting schema:

```typescript
async createSettingSchema(tenantCode: string, opts: { invokeContext: IInvoke }) {
  return this.settingService.create(
    tenantCode,
    {
      code: 'THEME',
      name: 'Theme Settings',
      attributes: {
        description: 'UI theme configuration',
        schema: {
          primaryColor: { type: 'string', format: 'color' },
          mode: { type: 'string', enum: ['light', 'dark'] },
          fontSize: { type: 'number', min: 12, max: 24 },
        },
      },
    },
    opts,
  );
}
```

### Create Setting Values

Then, create values for the schema:

```typescript
async createThemePreset(
  tenantCode: string,
  preset: ThemePresetDto,
  opts: { invokeContext: IInvoke },
) {
  return this.dataSettingService.create(
    tenantCode,
    {
      settingCode: 'THEME',
      code: preset.code,
      name: preset.name,
      attributes: {
        primaryColor: preset.primaryColor,
        mode: preset.mode,
        fontSize: preset.fontSize,
      },
    },
    opts,
  );
}
```

### Update Setting

```typescript
async updateTheme(
  pk: string,
  sk: string,
  updates: UpdateThemeDto,
  opts: { invokeContext: IInvoke },
) {
  return this.dataSettingService.update(
    { pk, sk },
    {
      name: updates.name,
      attributes: updates.attributes,
    },
    opts,
  );
}
```

### Delete Setting

```typescript
async deleteTheme(pk: string, sk: string, opts: { invokeContext: IInvoke }) {
  return this.dataSettingService.delete({ pk, sk }, opts);
}
```

### List Settings

```typescript
async getThemePresets(tenantCode: string) {
  return this.dataSettingService.list(tenantCode, {
    settingCode: 'THEME',
  });
}

async searchSettings(tenantCode: string, keyword: string) {
  return this.dataSettingService.list(tenantCode, {
    // Returns all settings for the tenant
  });
}
```

### Check Code Availability

```typescript
async isCodeAvailable(
  tenantCode: string,
  settingCode: string,
  code: string,
): Promise<boolean> {
  const exists = await this.dataSettingService.checkExistCode(
    tenantCode,
    settingCode,
    code,
  );
  return !exists;
}
```

## Data Model

### Setting Schema Key Pattern

```
pk: SETTING#[tenantCode]
sk: SETTING#[settingCode]

Example:
pk: SETTING#MBC
sk: SETTING#THEME
```

### Setting Data Key Pattern

```
pk: SETTING#[tenantCode]
sk: [settingCode]#[code]

Example:
pk: SETTING#MBC
sk: THEME#DARK_MODE
```

### Example Setting Data Structure

```json
{
  "pk": "SETTING#MBC",
  "sk": "THEME#DARK_MODE",
  "code": "DARK_MODE",
  "name": "Dark Mode Theme",
  "tenantCode": "MBC",
  "type": "MASTER",
  "isDeleted": false,
  "attributes": {
    "primaryColor": "#1a1a2e",
    "mode": "dark",
    "fontSize": 14
  }
}
```

## Common Use Cases

### Theme Configuration

```typescript
// Create theme presets
await dataSettingService.create(tenantCode, {
  settingCode: 'THEME',
  code: 'CORPORATE',
  name: 'Corporate Theme',
  attributes: { primaryColor: '#003366', mode: 'light', fontSize: 14 },
}, opts);
```

### Layout Preferences

```typescript
// Store user layout preferences
await dataSettingService.create(tenantCode, {
  settingCode: 'LAYOUT',
  code: 'COMPACT',
  name: 'Compact Layout',
  attributes: { sidebarWidth: 200, contentPadding: 16, density: 'compact' },
}, opts);
```

### Feature Flags

```typescript
// Store feature flags per tenant
await dataSettingService.create(tenantCode, {
  settingCode: 'FEATURE_FLAGS',
  code: 'BETA_FEATURES',
  name: 'Beta Features',
  attributes: { newDashboard: true, darkMode: true, experimentalApi: false },
}, opts);
```

## Related Packages

| Package | Description |
|---------|-------------|
| [@mbc-cqrs-serverless/core](https://www.npmjs.com/package/@mbc-cqrs-serverless/core) | Core CQRS framework |
| [@mbc-cqrs-serverless/master](https://www.npmjs.com/package/@mbc-cqrs-serverless/master) | Hierarchical settings |
| [@mbc-cqrs-serverless/tenant](https://www.npmjs.com/package/@mbc-cqrs-serverless/tenant) | Multi-tenancy support |

## Documentation

Full documentation available at [https://mbc-cqrs-serverless.mbc-net.com/](https://mbc-cqrs-serverless.mbc-net.com/)

## License

Copyright © 2024-2025, Murakami Business Consulting, Inc. [https://www.mbc-net.com/](https://www.mbc-net.com/)

This project is under the [MIT License](../../LICENSE.txt).
