![MBC CQRS serverless framework](https://mbc-cqrs-serverless.mbc-net.com/img/mbc-cqrs-serverless.png)

# MBC CQRS serverless framework Task package

## Description

The Task package provides comprehensive task management functionality in the MBC CQRS Serverless framework. It enables:

- Asynchronous task execution
- Task status tracking
- Progress monitoring
- Error handling and retries
- Task queue management
- Task history and logging

## Installation

```bash
npm install @mbc-cqrs-serverless/task
```

## Usage

### Basic Setup

1. Import and configure the task module:
```typescript
import { TaskModule } from '@mbc-cqrs-serverless/task';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    TaskModule.forRoot({
      queueUrl: process.env.TASK_QUEUE_URL,
      region: 'ap-northeast-1',
    }),
  ],
})
export class AppModule {}
```

### Creating Tasks

1. Define a task:
```typescript
import { Task, TaskMetadata } from '@mbc-cqrs-serverless/task';

@Task({
  name: 'ProcessOrder',
  maxRetries: 3,
  timeout: 300, // 5 minutes
})
export class ProcessOrderTask {
  async execute(
    data: any,
    metadata: TaskMetadata
  ): Promise<void> {
    // Task implementation
  }
}
```

2. Schedule a task:
```typescript
import { TaskService } from '@mbc-cqrs-serverless/task';

@Injectable()
export class OrderService {
  constructor(
    private readonly taskService: TaskService
  ) {}

  async processOrder(orderId: string): Promise<void> {
    await this.taskService.schedule('ProcessOrder', {
      orderId,
      items: [],
      // ... other data
    });
  }
}
```

### Task Status Tracking

1. Monitor task status:
```typescript
@Injectable()
export class TaskMonitor {
  constructor(
    private readonly taskService: TaskService
  ) {}

  async checkTaskStatus(taskId: string): Promise<TaskStatus> {
    const task = await this.taskService.getTask(taskId);
    return task.status;
  }

  async getTaskProgress(taskId: string): Promise<number> {
    const task = await this.taskService.getTask(taskId);
    return task.progress || 0;
  }
}
```

### Progress Updates

1. Update task progress:
```typescript
@Task({
  name: 'BatchProcess',
})
export class BatchProcessTask {
  async execute(
    data: any,
    metadata: TaskMetadata
  ): Promise<void> {
    const total = data.items.length;
    
    for (let i = 0; i < total; i++) {
      await this.processItem(data.items[i]);
      await metadata.updateProgress((i + 1) / total * 100);
    }
  }
}
```

### Error Handling and Retries

1. Configure retry behavior:
```typescript
@Task({
  name: 'SendEmail',
  maxRetries: 3,
  retryDelay: 60, // 1 minute
  retryStrategy: 'exponential',
})
export class SendEmailTask {
  async execute(
    data: any,
    metadata: TaskMetadata
  ): Promise<void> {
    try {
      await this.emailService.send(data);
    } catch (error) {
      if (error.retryable) {
        throw new RetryableError(error.message);
      }
      throw error;
    }
  }
}
```

### Queue Management

1. Work with multiple queues:
```typescript
@Injectable()
export class WorkflowService {
  constructor(
    private readonly taskService: TaskService
  ) {}

  async scheduleWorkflow(): Promise<void> {
    // High priority queue
    await this.taskService.schedule('CriticalTask', data, {
      queueUrl: process.env.HIGH_PRIORITY_QUEUE_URL,
    });

    // Default queue
    await this.taskService.schedule('NormalTask', data);
  }
}
```

### Task History and Logging

1. Access task history:
```typescript
@Injectable()
export class AuditService {
  constructor(
    private readonly taskService: TaskService
  ) {}

  async getTaskHistory(taskId: string): Promise<TaskHistory[]> {
    const history = await this.taskService.getTaskHistory(taskId);
    return history;
  }

  async getTaskLogs(taskId: string): Promise<TaskLog[]> {
    const logs = await this.taskService.getTaskLogs(taskId);
    return logs;
  }
}
```

## Documentation

Visit https://mbc-cqrs-serverless.mbc-net.com/ to view the full documentation, including:
- Task configuration
- Queue management
- Error handling strategies
- Monitoring and logging
- API reference

## License

Copyright &copy; 2024, Murakami Business Consulting, Inc. https://www.mbc-net.com/  
This project and sub projects are under the MIT License.
