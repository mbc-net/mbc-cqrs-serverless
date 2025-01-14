![MBC CQRS serverless framework](https://mbc-cqrs-serverless.mbc-net.com/img/mbc-cqrs-serverless.png)

# MBC CQRS serverless framework Sequence package

## Description

The Sequence package provides robust sequence number generation functionality for the MBC CQRS Serverless framework. It supports:

- Flexible sequence number generation
- Rotation by fiscal year, year, month, or day
- Customizable number formats
- Multi-tenant sequence management
- Atomic operations for concurrent access

## Installation

```bash
npm install @mbc-cqrs-serverless/sequence
```

## Usage

### Basic Setup

1. Import and configure the sequence module:
```typescript
import { SequenceModule } from '@mbc-cqrs-serverless/sequence';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    SequenceModule.forRoot({
      tableName: 'sequences',
      region: 'ap-northeast-1',
    }),
  ],
})
export class AppModule {}
```

### Creating Sequences

1. Define a sequence configuration:
```typescript
import { 
  SequenceConfig,
  RotateByEnum 
} from '@mbc-cqrs-serverless/sequence';

const invoiceSequence: SequenceConfig = {
  name: 'INVOICE',
  prefix: 'INV',
  padding: 6,
  rotateBy: RotateByEnum.FISCAL_YEAR,
  startNumber: 1,
};
```

2. Use the sequence service:
```typescript
import { SequencesService } from '@mbc-cqrs-serverless/sequence';

@Injectable()
export class InvoiceService {
  constructor(
    private readonly sequencesService: SequencesService
  ) {}

  async generateInvoiceNumber(): Promise<string> {
    const sequence = await this.sequencesService.next('INVOICE');
    return sequence.formattedNo; // Returns: "INV000001"
  }
}
```

### Rotation Strategies

1. Yearly rotation:
```typescript
const yearlySequence: SequenceConfig = {
  name: 'YEARLY_DOC',
  prefix: 'DOC',
  rotateBy: RotateByEnum.YEAR,
  format: '{{prefix}}-{{year}}-{{no}}', // DOC-2024-0001
};
```

2. Monthly rotation:
```typescript
const monthlySequence: SequenceConfig = {
  name: 'MONTHLY_ORDER',
  prefix: 'ORD',
  rotateBy: RotateByEnum.MONTH,
  format: '{{prefix}}{{year}}{{month}}{{no}}', // ORD202401001
};
```

3. Daily rotation:
```typescript
const dailySequence: SequenceConfig = {
  name: 'DAILY_TICKET',
  prefix: 'TKT',
  rotateBy: RotateByEnum.DAY,
  format: '{{prefix}}-{{date}}-{{no}}', // TKT-20240101-001
};
```

### Custom Formatting

1. Define custom format patterns:
```typescript
const customSequence: SequenceConfig = {
  name: 'CUSTOM_DOC',
  prefix: 'DOC',
  format: '{{prefix}}/{{year}}/{{tenantCode}}/{{no}}',
  padding: 4,
};
```

2. Use with tenant context:
```typescript
@Injectable()
export class DocumentService {
  constructor(
    private readonly sequencesService: SequencesService
  ) {}

  @UseTenant()
  async generateDocumentNumber(
    @TenantContext() tenantCode: string
  ): Promise<string> {
    const sequence = await this.sequencesService.next('CUSTOM_DOC', {
      tenantCode,
    });
    return sequence.formattedNo; // Returns: "DOC/2024/TENANT1/0001"
  }
}
```

### Concurrent Access

The package handles concurrent access automatically:

```typescript
@Injectable()
export class BulkProcessor {
  constructor(
    private readonly sequencesService: SequencesService
  ) {}

  async processBatch(): Promise<string[]> {
    // Safe for concurrent access
    const numbers = await Promise.all(
      Array(10).fill(null).map(() => 
        this.sequencesService.next('BATCH_SEQ')
      )
    );
    return numbers.map(seq => seq.formattedNo);
  }
}
```

### Error Handling

```typescript
import { SequenceError } from '@mbc-cqrs-serverless/sequence';

try {
  await sequencesService.next('INVALID_SEQ');
} catch (error) {
  if (error instanceof SequenceError) {
    console.error('Sequence error:', error.message);
  }
}
```

## Documentation


Visit https://mbc-cqrs-serverless.mbc-net.com/ to view the full documentation, including:
- Sequence configuration options
- Rotation strategies
- Format customization
- Usage examples
- API reference

## License

Copyright &copy; 2024, Murakami Business Consulting, Inc. https://www.mbc-net.com/  
This project and sub projects are under the MIT License.
