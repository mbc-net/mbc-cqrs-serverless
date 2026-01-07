![MBC CQRS serverless framework](https://mbc-cqrs-serverless.mbc-net.com/img/mbc-cqrs-serverless.png)

# @mbc-cqrs-serverless/sequence

[![npm version](https://badge.fury.io/js/@mbc-cqrs-serverless%2Fsequence.svg)](https://www.npmjs.com/package/@mbc-cqrs-serverless/sequence)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Robust sequence number generation for the MBC CQRS Serverless framework. Generate unique, formatted sequence numbers with automatic rotation support for invoices, orders, tickets, and more.

## Features

- **Atomic Counter**: DynamoDB-based atomic operations ensure no duplicates
- **Flexible Rotation**: Reset sequences by fiscal year, year, month, or day
- **Custom Formatting**: Configure prefixes, padding, and format patterns
- **Multi-tenant**: Isolated sequences per tenant
- **Hierarchical Codes**: Support up to 5 levels of code hierarchy

## Installation

```bash
npm install @mbc-cqrs-serverless/sequence
```

## Quick Start

### 1. Register the Module

```typescript
import { Module } from '@nestjs/common';
import { SequencesModule } from '@mbc-cqrs-serverless/sequence';

@Module({
  imports: [
    SequencesModule.register({
      enableController: true, // Optional: enable REST endpoints
    }),
  ],
})
export class AppModule {}
```

### 2. Generate Sequence Numbers

```typescript
import { Injectable } from '@nestjs/common';
import { SequencesService, RotateByEnum } from '@mbc-cqrs-serverless/sequence';
import { getUserContext, IInvoke } from '@mbc-cqrs-serverless/core';

@Injectable()
export class InvoiceService {
  constructor(private readonly sequencesService: SequencesService) {}

  async createInvoice(opts: { invokeContext: IInvoke }) {
    const { tenantCode } = getUserContext(opts.invokeContext);

    const seq = await this.sequencesService.generateSequenceItem(
      {
        tenantCode,
        typeCode: 'INVOICE',
        rotateBy: RotateByEnum.FISCAL_YEARLY,
      },
      opts,
    );

    console.log(seq.no);          // 1
    console.log(seq.formattedNo); // "INV-0001" (based on master data format)
    console.log(seq.issuedAt);    // Date object

    return seq;
  }
}
```

## API Reference

### SequencesService

| Method | Description |
|--------|-------------|
| `generateSequenceItem(dto, options)` | Generate sequence using master data configuration |
| `generateSequenceItemWithProvideSetting(dto, options)` | Generate sequence with inline settings |

### GenerateFormattedSequenceDto

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `tenantCode` | string | Yes | Tenant identifier |
| `typeCode` | string | Yes | Sequence type (e.g., 'INVOICE', 'ORDER') |
| `rotateBy` | RotateByEnum | No | Rotation strategy |
| `date` | Date | No | Date for sequence (default: now) |
| `prefix` | string | No | Prefix to add before formatted number |
| `postfix` | string | No | Postfix to add after formatted number |
| `params` | object | No | Additional parameters (code1-code5) |

### RotateByEnum

| Value | Description | Example Reset |
|-------|-------------|---------------|
| `FISCAL_YEARLY` | Reset on fiscal year start (April 1st in Japan) | Apr 1, 2024 |
| `YEARLY` | Reset on calendar year | Jan 1, 2024 |
| `MONTHLY` | Reset each month | First of each month |
| `DAILY` | Reset each day | Every day |
| `NONE` | Never reset, continuous increment | Never |

### SequenceEntity (Return Type)

```typescript
{
  id: string;        // Unique identifier
  no: number;        // Raw sequence number
  formattedNo: string; // Formatted sequence string
  issuedAt: Date;    // Timestamp of generation
}
```

## Usage Examples

### Fiscal Year Rotation (Japan)

Sequences reset on April 1st:

```typescript
const seq = await this.sequencesService.generateSequenceItem(
  {
    tenantCode: 'MBC',
    typeCode: 'INVOICE',
    rotateBy: RotateByEnum.FISCAL_YEARLY,
  },
  opts,
);
// FY2024: INV-0001, INV-0002, ...
// FY2025 (after Apr 1): INV-0001, INV-0002, ...
```

### Monthly Rotation

Sequences reset on the first of each month:

```typescript
const seq = await this.sequencesService.generateSequenceItem(
  {
    tenantCode: 'MBC',
    typeCode: 'ORDER',
    rotateBy: RotateByEnum.MONTHLY,
  },
  opts,
);
// January: ORD-202401-0001, ORD-202401-0002
// February: ORD-202402-0001, ORD-202402-0002
```

### Daily Rotation

Sequences reset every day:

```typescript
const seq = await this.sequencesService.generateSequenceItem(
  {
    tenantCode: 'MBC',
    typeCode: 'TICKET',
    rotateBy: RotateByEnum.DAILY,
  },
  opts,
);
// Day 1: TKT-20240115-001, TKT-20240115-002
// Day 2: TKT-20240116-001, TKT-20240116-002
```

### Hierarchical Sequences

Use code1-code5 for hierarchical sequence numbers:

```typescript
const seq = await this.sequencesService.generateSequenceItem(
  {
    tenantCode: 'MBC',
    typeCode: 'PRODUCT',
    params: {
      code1: 'ELECTRONICS',
      code2: 'PHONES',
    },
    rotateBy: RotateByEnum.YEARLY,
  },
  opts,
);
// Each category has its own sequence: ELECTRONICS-PHONES-0001
```

### Custom Settings (No Master Data)

Provide format settings directly without master data lookup:

```typescript
const seq = await this.sequencesService.generateSequenceItemWithProvideSetting(
  {
    tenantCode: 'MBC',
    typeCode: 'CUSTOM',
    format: '%%year%%-%%month#:0>2%%-%%no#:0>4%%',
    rotateBy: RotateByEnum.MONTHLY,
    prefix: 'DOC-',
  },
  opts,
);
// Result: DOC-2024-01-0001
```

### Format Patterns

Format strings use `%%key%%` syntax with optional padding:

| Pattern | Output | Description |
|---------|--------|-------------|
| `%%no%%` | `1` | Raw number |
| `%%no#:0>4%%` | `0001` | Zero-padded to 4 digits |
| `%%year%%` | `2024` | Current year |
| `%%month%%` | `1` | Current month (1-12) |
| `%%month#:0>2%%` | `01` | Zero-padded month |
| `%%day%%` | `15` | Current day |
| `%%fiscal_year%%` | `71` | Fiscal year number |
| `%%code1%%` | `DEPT` | Hierarchical code 1 |

## Master Data Configuration

The `generateSequenceItem` method reads format configuration from master data:

```json
{
  "pk": "MASTER#MBC",
  "sk": "MASTER_DATA#INVOICE",
  "format": "%%year%%-%%no#:0>4%%",
  "startMonth": 4,
  "registerDate": "2024-04-01"
}
```

## Concurrent Access Safety

All sequence operations use DynamoDB atomic counters, ensuring thread-safe generation:

```typescript
// Safe for concurrent requests
const results = await Promise.all([
  sequencesService.generateSequenceItem({ tenantCode, typeCode: 'ORDER' }, opts),
  sequencesService.generateSequenceItem({ tenantCode, typeCode: 'ORDER' }, opts),
  sequencesService.generateSequenceItem({ tenantCode, typeCode: 'ORDER' }, opts),
]);
// Results: [{ no: 1 }, { no: 2 }, { no: 3 }] - guaranteed unique
```

## Related Packages

| Package | Description |
|---------|-------------|
| [@mbc-cqrs-serverless/core](https://www.npmjs.com/package/@mbc-cqrs-serverless/core) | Core CQRS framework |
| [@mbc-cqrs-serverless/master](https://www.npmjs.com/package/@mbc-cqrs-serverless/master) | Master data for sequence formats |

## Documentation

Full documentation available at [https://mbc-cqrs-serverless.mbc-net.com/](https://mbc-cqrs-serverless.mbc-net.com/)

- [Sequence Service Guide](https://mbc-cqrs-serverless.mbc-net.com/docs/sequence-service)
- [Build a Todo App Tutorial](https://mbc-cqrs-serverless.mbc-net.com/docs/build-todo-app)

## License

Copyright © 2024-2025, Murakami Business Consulting, Inc. [https://www.mbc-net.com/](https://www.mbc-net.com/)

This project is under the [MIT License](../../LICENSE.txt).
