---
name: mbc-generate
description: Generate MBC CQRS Serverless boilerplate code. Use this when the user wants to create a new module, service, controller, command, query, event handler, or data sync handler for MBC CQRS Serverless framework.
---

## Pre-flight Check (Version Update)

Before executing this skill, check for updates:

1. Run `mbc install-skills --check` to check if a newer version is available
2. If the output shows "Update available: X.Y.Z → A.B.C", ask the user:
   - "A newer version of MBC skills is available (X.Y.Z → A.B.C). Would you like to update before proceeding?"
3. If the user agrees, run `mbc install-skills --force` to update
4. If the user declines or skills are up-to-date, proceed with the skill

**Note**: Skip this check if the user explicitly says to skip updates or if you've already checked in this session.

---

# MBC CQRS Serverless Code Generator

This skill generates boilerplate code following MBC CQRS Serverless best practices.

## Usage

When the user requests code generation, follow these patterns:

### Module Generation

When user says: "create a module for [Entity]" or "generate [Entity] module"

Generate the following files:

#### 1. Module File (`[entity].module.ts`)

```typescript
import { Module } from '@nestjs/common';
import { CommandModule } from '@mbc-cqrs-serverless/core';
import { [Entity]Controller } from './[entity].controller';
import { [Entity]Service } from './[entity].service';
import { [Entity]DataSyncRdsHandler } from './handler/[entity]-rds.handler';

@Module({
  imports: [
    CommandModule.register({
      tableName: '[entity]',
      dataSyncHandlers: [[Entity]DataSyncRdsHandler],
    }),
  ],
  controllers: [[Entity]Controller],
  providers: [[Entity]Service],
  exports: [[Entity]Service],
})
export class [Entity]Module {}
```

#### 2. Controller File (`[entity].controller.ts`)

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { [Entity]Service } from './[entity].service';
import { Create[Entity]Dto } from './dto/create-[entity].dto';
import { Update[Entity]Dto } from './dto/update-[entity].dto';
import { Search[Entity]Dto } from './dto/search-[entity].dto';
import { INVOKE_CONTEXT, IInvoke } from '@mbc-cqrs-serverless/core';

@ApiTags('[entity]')
@Controller('[entity]')
export class [Entity]Controller {
  constructor(private readonly [entity]Service: [Entity]Service) {}

  @Post()
  async create(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Body() dto: Create[Entity]Dto,
  ) {
    return this.[entity]Service.create(dto, invokeContext);
  }

  @Get()
  async search(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Query() dto: Search[Entity]Dto,
  ) {
    return this.[entity]Service.search(dto, invokeContext);
  }

  @Get(':pk/:sk')
  async findOne(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Param('pk') pk: string,
    @Param('sk') sk: string,
  ) {
    return this.[entity]Service.findOne({ pk, sk }, invokeContext);
  }

  @Put(':pk/:sk')
  async update(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Param('pk') pk: string,
    @Param('sk') sk: string,
    @Body() dto: Update[Entity]Dto,
  ) {
    return this.[entity]Service.update({ pk, sk }, dto, invokeContext);
  }

  @Delete(':pk/:sk')
  async remove(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Param('pk') pk: string,
    @Param('sk') sk: string,
  ) {
    return this.[entity]Service.remove({ pk, sk }, invokeContext);
  }
}
```

#### 3. Service File (`[entity].service.ts`)

```typescript
import { Injectable } from '@nestjs/common';
import { basename } from 'path';
import {
  CommandService,
  DataService,
  DetailKey,
  generateId,
  getCommandSource,
  getUserContext,
  IInvoke,
  VERSION_FIRST,
} from '@mbc-cqrs-serverless/core';
import { Create[Entity]Dto } from './dto/create-[entity].dto';
import { Update[Entity]Dto } from './dto/update-[entity].dto';
import { Search[Entity]Dto } from './dto/search-[entity].dto';
import { [Entity]CommandDto } from './dto/[entity]-command.dto';

@Injectable()
export class [Entity]Service {
  constructor(
    private readonly commandService: CommandService,
    private readonly dataService: DataService,
  ) {}

  async create(dto: Create[Entity]Dto, invokeContext: IInvoke) {
    const { tenantCode } = getUserContext(invokeContext);
    const pk = `[ENTITY]#${tenantCode}`;
    const sk = `[ENTITY]#${dto.code}`;

    const command = new [Entity]CommandDto({
      pk,
      sk,
      id: generateId(pk, sk),
      tenantCode,
      code: dto.code,
      name: dto.name,
      type: '[ENTITY]',
      version: VERSION_FIRST,
      attributes: dto.attributes,
    });

    const commandSource = getCommandSource(
      basename(__dirname),
      this.constructor.name,
      'create',
    );

    return this.commandService.publishAsync(command, {
      source: commandSource,
      invokeContext,
    });
  }

  async search(dto: Search[Entity]Dto, invokeContext: IInvoke) {
    const { tenantCode } = getUserContext(invokeContext);
    return this.dataService.listByPk({
      pk: `[ENTITY]#${tenantCode}`,
      limit: dto.limit,
      cursor: dto.cursor,
    });
  }

  async findOne(key: DetailKey, invokeContext: IInvoke) {
    return this.dataService.getItem(key);
  }

  async update(key: DetailKey, dto: Update[Entity]Dto, invokeContext: IInvoke) {
    const existingItem = await this.dataService.getItem(key);

    const commandSource = getCommandSource(
      basename(__dirname),
      this.constructor.name,
      'update',
    );

    return this.commandService.publishPartialUpdateAsync(
      {
        pk: key.pk,
        sk: key.sk,
        version: existingItem.version,
        name: dto.name,
        attributes: { ...existingItem.attributes, ...dto.attributes },
      },
      {
        source: commandSource,
        invokeContext,
      },
    );
  }

  async remove(key: DetailKey, invokeContext: IInvoke) {
    const existingItem = await this.dataService.getItem(key);

    const commandSource = getCommandSource(
      basename(__dirname),
      this.constructor.name,
      'remove',
    );

    return this.commandService.publishPartialUpdateAsync(
      {
        pk: key.pk,
        sk: key.sk,
        version: existingItem.version,
        isDeleted: true,
      },
      {
        source: commandSource,
        invokeContext,
      },
    );
  }
}
```

#### 4. DTOs (`dto/` directory)

**create-[entity].dto.ts:**
```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class Create[Entity]Dto {
  @ApiProperty({ description: 'Unique code for the [entity]' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Name of the [entity]' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Additional attributes' })
  @IsObject()
  @IsOptional()
  attributes?: Record<string, any>;
}
```

**update-[entity].dto.ts:**
```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class Update[Entity]Dto {
  @ApiPropertyOptional({ description: 'Name of the [entity]' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Additional attributes' })
  @IsObject()
  @IsOptional()
  attributes?: Record<string, any>;
}
```

**search-[entity].dto.ts:**
```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class Search[Entity]Dto {
  @ApiPropertyOptional({ description: 'Maximum number of items to return' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ description: 'Cursor for pagination' })
  @IsString()
  @IsOptional()
  cursor?: string;
}
```

**[entity]-command.dto.ts:**
```typescript
import { CommandDto } from '@mbc-cqrs-serverless/core';

export class [Entity]CommandDto extends CommandDto {
  constructor(partial: Partial<[Entity]CommandDto>) {
    super();
    Object.assign(this, partial);
  }
}
```

#### 5. Data Sync Handler (`handler/[entity]-rds.handler.ts`)

```typescript
import { DataSyncHandler, IDataSyncHandler } from '@mbc-cqrs-serverless/core';
import { CommandModel, DataModel } from '@mbc-cqrs-serverless/core';
import { PrismaService } from '../../prisma/prisma.service';

@DataSyncHandler({ type: '[ENTITY]' })
export class [Entity]DataSyncRdsHandler implements IDataSyncHandler {
  constructor(private readonly prismaService: PrismaService) {}

  async up(cmd: CommandModel, data: DataModel): Promise<void> {
    if (data.isDeleted) {
      await this.prismaService.[entity].delete({
        where: { id: data.id },
      });
      return;
    }

    await this.prismaService.[entity].upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        tenantCode: data.tenantCode,
        code: data.code,
        name: data.name,
        attributes: data.attributes,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
      update: {
        name: data.name,
        attributes: data.attributes,
        updatedAt: data.updatedAt,
      },
    });
  }

  async down(cmd: CommandModel, data: DataModel): Promise<void> {
    // Implement rollback logic if needed
  }
}
```

## Naming Conventions

When generating code, follow these naming conventions:

| Item | Convention | Example |
|------|------------|---------|
| Module | PascalCase + "Module" | `OrderModule` |
| Controller | PascalCase + "Controller" | `OrderController` |
| Service | PascalCase + "Service" | `OrderService` |
| DTO | PascalCase + "Dto" | `CreateOrderDto` |
| Handler | PascalCase + "Handler" | `OrderDataSyncRdsHandler` |
| File name | kebab-case | `order.module.ts` |
| DynamoDB PK/SK | SCREAMING_SNAKE_CASE | `ORDER#tenantCode` |
| Variable | camelCase | `orderService` |

## Directory Structure

Generate files in this structure:

```
src/
└── [entity]/
    ├── [entity].module.ts
    ├── [entity].controller.ts
    ├── [entity].service.ts
    ├── dto/
    │   ├── create-[entity].dto.ts
    │   ├── update-[entity].dto.ts
    │   ├── search-[entity].dto.ts
    │   └── [entity]-command.dto.ts
    └── handler/
        └── [entity]-rds.handler.ts
```

## Important Notes

1. **Always use `publishAsync`** for command publishing (not `publishSync`) unless immediate consistency is required
2. **Include `tenantCode`** from `getUserContext()` for multi-tenant support
3. **Use `VERSION_FIRST` (0)** for new entities, existing version for updates
4. **Generate unique IDs** using `generateId(pk, sk)`
5. **Use class-validator decorators** for DTO validation
6. **Register DataSyncHandler** in the module's `CommandModule.register()`

## Additional Templates

### Event Handler (`handler/[entity]-event.handler.ts`)

For custom event processing:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CommandModel, DataModel } from '@mbc-cqrs-serverless/core';

@Injectable()
export class [Entity]EventHandler {
  private readonly logger = new Logger([Entity]EventHandler.name);

  @OnEvent('[ENTITY].created')
  async handleCreated(payload: { command: CommandModel; data: DataModel }) {
    this.logger.log(`[Entity] created: ${payload.data.id}`);
    // Add custom logic here (e.g., send notification, update cache)
  }

  @OnEvent('[ENTITY].updated')
  async handleUpdated(payload: { command: CommandModel; data: DataModel }) {
    this.logger.log(`[Entity] updated: ${payload.data.id}`);
    // Add custom logic here
  }

  @OnEvent('[ENTITY].deleted')
  async handleDeleted(payload: { command: CommandModel; data: DataModel }) {
    this.logger.log(`[Entity] deleted: ${payload.data.id}`);
    // Add custom logic here
  }
}
```

### Query Handler for Complex Searches (`[entity].query.ts`)

For advanced query operations:

```typescript
import { Injectable } from '@nestjs/common';
import {
  DataService,
  getUserContext,
  IInvoke,
} from '@mbc-cqrs-serverless/core';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class [Entity]QueryService {
  constructor(
    private readonly dataService: DataService,
    private readonly prismaService: PrismaService,
  ) {}

  /**
   * Search with full-text and filters (uses RDS)
   */
  async searchAdvanced(
    dto: AdvancedSearch[Entity]Dto,
    invokeContext: IInvoke,
  ) {
    const { tenantCode } = getUserContext(invokeContext);

    return this.prismaService.[entity].findMany({
      where: {
        tenantCode,
        ...(dto.name && { name: { contains: dto.name } }),
        ...(dto.status && { status: dto.status }),
        ...(dto.fromDate && { createdAt: { gte: dto.fromDate } }),
        ...(dto.toDate && { createdAt: { lte: dto.toDate } }),
      },
      orderBy: { [dto.sortBy || 'createdAt']: dto.sortOrder || 'desc' },
      skip: dto.offset || 0,
      take: dto.limit || 20,
    });
  }

  /**
   * Get entity history (uses DynamoDB command table)
   */
  async getHistory(key: DetailKey, invokeContext: IInvoke) {
    return this.dataService.listVersions(key);
  }

  /**
   * Aggregate statistics
   */
  async getStatistics(invokeContext: IInvoke) {
    const { tenantCode } = getUserContext(invokeContext);

    const [total, byStatus] = await Promise.all([
      this.prismaService.[entity].count({ where: { tenantCode } }),
      this.prismaService.[entity].groupBy({
        by: ['status'],
        where: { tenantCode },
        _count: true,
      }),
    ]);

    return { total, byStatus };
  }
}
```

### Elasticsearch Sync Handler (`handler/[entity]-es.handler.ts`)

For full-text search synchronization:

```typescript
import { DataSyncHandler, IDataSyncHandler } from '@mbc-cqrs-serverless/core';
import { CommandModel, DataModel } from '@mbc-cqrs-serverless/core';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';

@DataSyncHandler({ type: '[ENTITY]' })
export class [Entity]DataSyncEsHandler implements IDataSyncHandler {
  constructor(private readonly esService: ElasticsearchService) {}

  async up(cmd: CommandModel, data: DataModel): Promise<void> {
    if (data.isDeleted) {
      await this.esService.delete({
        index: '[entity]',
        id: data.id,
      });
      return;
    }

    await this.esService.index({
      index: '[entity]',
      id: data.id,
      document: {
        id: data.id,
        tenantCode: data.tenantCode,
        code: data.code,
        name: data.name,
        attributes: data.attributes,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
    });
  }

  async down(cmd: CommandModel, data: DataModel): Promise<void> {
    // Implement rollback logic if needed
  }
}
```

### GraphQL Resolver (`[entity].resolver.ts`)

For GraphQL API:

```typescript
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { [Entity]Service } from './[entity].service';
import { [Entity] } from './entities/[entity].entity';
import { Create[Entity]Input } from './dto/create-[entity].input';
import { Update[Entity]Input } from './dto/update-[entity].input';
import { INVOKE_CONTEXT, IInvoke } from '@mbc-cqrs-serverless/core';

@Resolver(() => [Entity])
export class [Entity]Resolver {
  constructor(private readonly [entity]Service: [Entity]Service) {}

  @Query(() => [[Entity]], { name: '[entity]s' })
  findAll(@INVOKE_CONTEXT() invokeContext: IInvoke) {
    return this.[entity]Service.search({}, invokeContext);
  }

  @Query(() => [Entity], { name: '[entity]' })
  findOne(
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Args('pk') pk: string,
    @Args('sk') sk: string,
  ) {
    return this.[entity]Service.findOne({ pk, sk }, invokeContext);
  }

  @Mutation(() => [Entity])
  create[Entity](
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Args('input') input: Create[Entity]Input,
  ) {
    return this.[entity]Service.create(input, invokeContext);
  }

  @Mutation(() => [Entity])
  update[Entity](
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Args('pk') pk: string,
    @Args('sk') sk: string,
    @Args('input') input: Update[Entity]Input,
  ) {
    return this.[entity]Service.update({ pk, sk }, input, invokeContext);
  }

  @Mutation(() => Boolean)
  remove[Entity](
    @INVOKE_CONTEXT() invokeContext: IInvoke,
    @Args('pk') pk: string,
    @Args('sk') sk: string,
  ) {
    return this.[entity]Service.remove({ pk, sk }, invokeContext);
  }
}
```

## Customization Questions

Before generating, ask the user these questions to customize the output:

### Required Questions

1. **"What is the entity name?"**
   - Example: "Order", "Product", "Customer"
   - Used for all file names and class names

2. **"What attributes should the entity have?"**
   - List the fields with types
   - Example: `code: string, name: string, price: number, status: OrderStatus`

### Optional Questions

3. **"Do you need RDS synchronization?"**
   - Yes → Generate `[entity]-rds.handler.ts`
   - No → Skip DataSyncHandler

4. **"Do you need Elasticsearch synchronization?"**
   - Yes → Generate `[entity]-es.handler.ts`
   - No → Skip ES handler

5. **"Do you need GraphQL support?"**
   - Yes → Generate `[entity].resolver.ts` and GraphQL input types
   - No → REST API only

6. **"Do you need soft delete or hard delete?"**
   - Soft delete (default) → Set `isDeleted: true`
   - Hard delete → Actually delete the record

7. **"Do you need event handlers for custom logic?"**
   - Yes → Generate `[entity]-event.handler.ts`
   - No → Skip event handler

8. **"Do you need advanced query support?"**
   - Yes → Generate `[entity].query.ts` with search, history, statistics
   - No → Basic CRUD only

### Generation Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  User Request: "Create Order module"                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Ask Customization Questions                                │
│  • Entity attributes?                                       │
│  • RDS sync needed?                                         │
│  • GraphQL support?                                         │
│  • Soft/Hard delete?                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Generate Files Based on Answers                            │
│                                                             │
│  Required:              Optional:                           │
│  ├── module.ts          ├── [entity]-rds.handler.ts        │
│  ├── controller.ts      ├── [entity]-es.handler.ts         │
│  ├── service.ts         ├── [entity].resolver.ts           │
│  └── dto/               ├── [entity]-event.handler.ts      │
│      ├── create.dto     └── [entity].query.ts              │
│      ├── update.dto                                         │
│      └── search.dto                                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Post-Generation Instructions                               │
│  • Register module in AppModule                             │
│  • Add Prisma model (if RDS)                                │
│  • Run migrations                                           │
└─────────────────────────────────────────────────────────────┘
```
