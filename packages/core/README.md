![MBC CQRS serverless framework](https://mbc-cqrs-serverless.mbc-net.com/img/mbc-cqrs-serverless.png)

# MBC CQRS serverless framework Core package

## Description

The Core package provides the foundational functionality for the MBC CQRS Serverless framework. It implements:

- Command Query Responsibility Segregation (CQRS) patterns
- Event-driven architecture support
- Data persistence and retrieval
- Authentication and authorization
- Multi-tenant data isolation
- AWS service integrations

## Installation

```bash
npm install @mbc-cqrs-serverless/core
```

## Usage

### Basic Setup

1. Import and configure the core module:
```typescript
import { CoreModule } from '@mbc-cqrs-serverless/core';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    CoreModule.forRoot({
      region: 'ap-northeast-1',
      stage: 'dev',
    }),
  ],
})
export class AppModule {}
```

### Command Handling

1. Create a command:
```typescript
import { CommandInputModel } from '@mbc-cqrs-serverless/core';

export class CreateUserCommand implements CommandInputModel {
  readonly pk: string;
  readonly sk: string;
  readonly id: string;
  
  constructor(public readonly userId: string, public readonly userData: any) {
    this.pk = `USER#${userId}`;
    this.sk = `METADATA#${userId}`;
    this.id = userId;
  }
}
```

2. Implement a command handler:
```typescript
import { CommandHandler, ICommandHandler } from '@mbc-cqrs-serverless/core';

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  async execute(command: CreateUserCommand): Promise<void> {
    // Implementation
  }
}
```

### Event Handling

1. Create an event handler:
```typescript
import { EventsHandler, IEventHandler } from '@mbc-cqrs-serverless/core';
import { UserCreatedEvent } from './user-created.event';

@EventsHandler(UserCreatedEvent)
export class UserCreatedHandler implements IEventHandler<UserCreatedEvent> {
  async handle(event: UserCreatedEvent): Promise<void> {
    // Implementation
  }
}
```

### Data Access

1. Use the DataService for persistence:
```typescript
import { DataService, InjectDataService } from '@mbc-cqrs-serverless/core';

@Injectable()
export class UserService {
  constructor(
    @InjectDataService() private readonly dataService: DataService
  ) {}

  async getUser(userId: string): Promise<User> {
    return this.dataService.findOne({
      pk: `USER#${userId}`,
      sk: `METADATA#${userId}`,
    });
  }
}
```

### Authentication & Authorization

1. Implement role-based access:
```typescript
import { RolesGuard, Roles } from '@mbc-cqrs-serverless/core';

@Controller('users')
@UseGuards(RolesGuard)
export class UserController {
  @Post()
  @Roles('admin')
  async createUser(@Body() userData: CreateUserDto): Promise<void> {
    // Implementation
  }
}
```

### Multi-tenancy

1. Configure tenant isolation:
```typescript
import { TenantContext, UseTenant } from '@mbc-cqrs-serverless/core';

@Injectable()
export class UserService {
  @UseTenant()
  async getUsersForTenant(
    @TenantContext() tenantId: string
  ): Promise<User[]> {
    // Implementation with automatic tenant isolation
  }
}
```

### AWS Integration

1. Use AWS services:
```typescript
import { 
  StepFunctionService, 
  NotificationService 
} from '@mbc-cqrs-serverless/core';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly stepFunctions: StepFunctionService,
    private readonly notifications: NotificationService
  ) {}

  async startWorkflow(data: any): Promise<void> {
    await this.stepFunctions.startExecution({
      stateMachineArn: 'your-state-machine-arn',
      input: JSON.stringify(data),
    });
  }
}
```

## Error Handling

The core package provides standardized error handling:

```typescript
import { 
  CommandError,
  ValidationError,
  NotFoundError 
} from '@mbc-cqrs-serverless/core';

@CommandHandler(UpdateUserCommand)
export class UpdateUserHandler implements ICommandHandler<UpdateUserCommand> {
  async execute(command: UpdateUserCommand): Promise<void> {
    if (!command.userId) {
      throw new ValidationError('User ID is required');
    }
    
    const user = await this.userService.findById(command.userId);
    if (!user) {
      throw new NotFoundError(`User ${command.userId} not found`);
    }
    
    // Implementation
  }
}
```

## Documentation

Visit https://mbc-cqrs-serverless.mbc-net.com/ to view the full documentation, including:
- Architecture overview
- Core concepts and patterns
- AWS integration details
- Security features
- API reference

## License

Copyright &copy; 2024, Murakami Business Consulting, Inc. https://www.mbc-net.com/  
This project and sub projects are under the MIT License.
