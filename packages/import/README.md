![MBC CQRS serverless framework](https://mbc-cqrs-serverless.mbc-net.com/img/mbc-cqrs-serverless.png)

# @mbc-cqrs-serverless/import

[![npm version](https://badge.fury.io/js/@mbc-cqrs-serverless%2Fimport.svg)](https://www.npmjs.com/package/@mbc-cqrs-serverless/import)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Flexible data import module for the MBC CQRS Serverless framework. Import data from REST APIs, CSV files, and ZIP archives with validation, transformation, and async processing.

## Features

- **Multi-Source Import**: Support for REST API, CSV files, and ZIP archives
- **Strategy Pattern**: Customizable validation and transformation per entity type
- **Two-Phase Processing**: Separate ingestion and business logic phases
- **Dual Processing Modes**: DIRECT mode for small files, STEP_FUNCTION for large-scale imports
- **Progress Tracking**: Real-time status updates via SNS notifications
- **Error Handling**: Built-in alarm notifications and row-level error tracking

## Installation

```bash
npm install @mbc-cqrs-serverless/import
```

## Quick Start

### 1. Register the Module

```typescript
import { Module } from '@nestjs/common';
import { ImportModule } from '@mbc-cqrs-serverless/import';
import { ProductImportStrategy } from './strategies/product-import.strategy';
import { ProductProcessStrategy } from './strategies/product-process.strategy';
import { ProductModule } from './product/product.module';

@Module({
  imports: [
    ImportModule.register({
      profiles: [
        {
          tableName: 'product',
          importStrategy: ProductImportStrategy,
          processStrategy: ProductProcessStrategy,
        },
      ],
      imports: [ProductModule], // Optional: modules that provide strategy dependencies
      enableController: true, // Optional: enable REST endpoints
    }),
  ],
})
export class AppModule {}
```

### 2. Implement Import Strategy

```typescript
import { Injectable } from '@nestjs/common';
import { IImportStrategy } from '@mbc-cqrs-serverless/import';

@Injectable()
export class ProductImportStrategy implements IImportStrategy<RawProductInput, ProductDto> {
  async transform(input: RawProductInput): Promise<ProductDto> {
    return {
      code: input.product_code?.trim(),
      name: input.product_name?.trim(),
      price: parseFloat(input.price),
      category: input.category?.toUpperCase(),
    };
  }

  async validate(dto: ProductDto): Promise<void> {
    if (!dto.code) throw new Error('Product code is required');
    if (!dto.name) throw new Error('Product name is required');
    if (isNaN(dto.price) || dto.price < 0) throw new Error('Invalid price');
  }
}
```

### 3. Implement Process Strategy

```typescript
import { Injectable } from '@nestjs/common';
import {
  IProcessStrategy,
  ComparisonStatus,
  ComparisonResult,
} from '@mbc-cqrs-serverless/import';
import { CommandService, DataModel, CommandInputModel } from '@mbc-cqrs-serverless/core';

// Define your entity model
interface ProductModel extends DataModel {
  code: string;
  name: string;
  price: number;
}

@Injectable()
export class ProductProcessStrategy implements IProcessStrategy<ProductModel, ProductDto> {
  constructor(
    private readonly productService: ProductService,
    private readonly commandService: CommandService,
  ) {}

  async compare(dto: ProductDto, tenantCode: string): Promise<ComparisonResult<ProductModel>> {
    const existing = await this.productService.findByCode(dto.code, tenantCode);
    if (!existing) {
      return { status: ComparisonStatus.NOT_EXIST };
    }
    if (this.hasChanges(existing, dto)) {
      return { status: ComparisonStatus.CHANGED, existingData: existing };
    }
    return { status: ComparisonStatus.EQUAL };
  }

  async map(
    status: ComparisonStatus.NOT_EXIST | ComparisonStatus.CHANGED,
    dto: ProductDto,
    tenantCode: string,
    existingData?: ProductModel,
  ): Promise<CommandInputModel> {
    return {
      pk: `PRODUCT#${tenantCode}`,
      sk: `PRODUCT#${dto.code}`,
      code: dto.code,
      name: dto.name,
      attributes: { price: dto.price },
    };
  }

  getCommandService(): CommandService {
    return this.commandService;
  }
}
```

## Architecture

The import module uses a two-phase architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Import Architecture                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Phase 1: Ingestion                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     │
│  │ REST API /   │────▶│ ImportStrategy│────▶│  Temp Table  │     │
│  │ CSV / ZIP    │     │ transform()   │     │  (CREATED)   │     │
│  └──────────────┘     │ validate()    │     └──────────────┘     │
│                       └──────────────┘            │              │
│                                                   ▼ DynamoDB     │
│  Phase 2: Processing                              │ Streams      │
│  ┌──────────────┐     ┌──────────────┐     ┌─────┴────────┐     │
│  │ ProcessStrategy│◀───│  SNS/SQS     │◀────│   Lambda     │     │
│  │ compare()    │     │  Event       │     │   Trigger    │     │
│  │ map()        │     └──────────────┘     └──────────────┘     │
│  └──────────────┘                                                │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐     ┌──────────────┐                          │
│  │ CommandService│────▶│ Final Table  │                          │
│  │ publish()    │     │ (Data Store) │                          │
│  └──────────────┘     └──────────────┘                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## API Reference

### ImportService

| Method | Description |
|--------|-------------|
| `createWithApi(dto, options)` | Import single record from REST API |
| `handleCsvImport(dto, options)` | Import from CSV file (DIRECT or STEP_FUNCTION) |
| `createCsvJob(dto, options)` | Create CSV import job for Step Functions |
| `createZipJob(dto, options)` | Create ZIP import job for Step Functions |
| `createImport(dto, options)` | Create import record in temp table |
| `updateStatus(key, status, payload?, attributes?, notifyId?)` | Update import status |
| `getImportByKey(key)` | Get import record by key |
| `incrementParentJobCounters(parentKey, childSucceeded)` | Update parent job progress |

### IImportStrategy Interface

```typescript
interface IImportStrategy<TInput extends object, TAttributesDto extends object> {
  transform(input: TInput): Promise<TAttributesDto>;
  validate(data: TAttributesDto): Promise<void>;
}
```

### IProcessStrategy Interface

```typescript
interface IProcessStrategy<TEntity extends DataModel, TAttributesDto extends object> {
  compare(importAttributes: TAttributesDto, tenantCode: string): Promise<ComparisonResult<TEntity>>;
  map(status: ComparisonStatus, importAttributes: TAttributesDto, tenantCode: string, existingData?: TEntity): Promise<CommandInputModel | CommandPartialInputModel>;
  getCommandService(): CommandService;
}

interface ComparisonResult<TEntity> {
  status: ComparisonStatus;
  existingData?: TEntity; // Provided when status is CHANGED
}

enum ComparisonStatus {
  NOT_EXIST = 'NOT_EXIST',
  CHANGED = 'CHANGED',
  EQUAL = 'EQUAL',
}
```

### ImportStatusEnum

| Status | Description |
|--------|-------------|
| `CREATED` | Import record created |
| `PROCESSING` | Being processed |
| `COMPLETED` | Successfully completed |
| `FAILED` | Processing failed |

## Usage Examples

### REST API Import

```typescript
@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('product')
  async importProduct(
    @Body() dto: ImportProductDto,
    @InvokeContext() ctx: IInvoke,
  ) {
    return this.importService.createWithApi(
      {
        tableName: 'product',
        tenantCode: dto.tenantCode,
        attributes: dto,
      },
      { invokeContext: ctx },
    );
  }
}
```

### CSV Import (Direct Mode)

Process small CSV files immediately:

```typescript
async importSmallCsv(bucket: string, key: string, opts: { invokeContext: IInvoke }) {
  return this.importService.handleCsvImport(
    {
      tenantCode: 'MBC',
      tableName: 'product',
      bucket,
      key,
      processingMode: 'DIRECT',
    },
    opts,
  );
}
```

### CSV Import (Step Functions Mode)

Process large CSV files with Step Functions orchestration:

```typescript
async importLargeCsv(bucket: string, key: string, opts: { invokeContext: IInvoke }) {
  return this.importService.handleCsvImport(
    {
      tenantCode: 'MBC',
      tableName: 'product',
      bucket,
      key,
      processingMode: 'STEP_FUNCTION',
    },
    opts,
  );
}
```

### ZIP Import

Import multiple CSV files from a ZIP archive:

```typescript
async importZip(bucket: string, key: string, opts: { invokeContext: IInvoke }) {
  return this.importService.createZipJob(
    {
      tenantCode: 'MBC',
      bucket,
      key,
    },
    opts,
  );
}
```

### Check Import Status

```typescript
async checkStatus(pk: string, sk: string) {
  const importJob = await this.importService.getImportByKey({ pk, sk });
  return {
    status: importJob.status,
    totalRows: importJob.totalRows,
    processedRows: importJob.processedRows,
    succeededRows: importJob.succeededRows,
    failedRows: importJob.failedRows,
  };
}
```

## Processing Modes

| Mode | Use Case | Processing |
|------|----------|------------|
| `DIRECT` | Small files (< 1000 rows) | Immediate, synchronous |
| `STEP_FUNCTION` | Large files, mission-critical | Async, resilient, tracked |

## Related Packages

| Package | Description |
|---------|-------------|
| [@mbc-cqrs-serverless/core](https://www.npmjs.com/package/@mbc-cqrs-serverless/core) | Core CQRS framework |
| [@mbc-cqrs-serverless/task](https://www.npmjs.com/package/@mbc-cqrs-serverless/task) | Task processing for async jobs |

## Documentation

Full documentation available at [https://mbc-cqrs-serverless.mbc-net.com/](https://mbc-cqrs-serverless.mbc-net.com/)

- [Import Service Guide](https://mbc-cqrs-serverless.mbc-net.com/docs/import-service)

## License

Copyright © 2024-2025, Murakami Business Consulting, Inc. [https://www.mbc-net.com/](https://www.mbc-net.com/)

This project is under the [MIT License](../../LICENSE.txt).
