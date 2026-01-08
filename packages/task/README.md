![MBC CQRS serverless framework](https://mbc-cqrs-serverless.mbc-net.com/img/mbc-cqrs-serverless.png)

# @mbc-cqrs-serverless/task

[![npm version](https://badge.fury.io/js/@mbc-cqrs-serverless%2Ftask.svg)](https://www.npmjs.com/package/@mbc-cqrs-serverless/task)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Asynchronous task processing for the MBC CQRS Serverless framework. Execute long-running operations, batch processes, and background jobs with status tracking and SNS notifications.

## Features

- **Async Task Execution**: Process long-running operations in background
- **Step Functions Integration**: Orchestrate complex workflows with AWS Step Functions
- **Sub-task Support**: Break large tasks into smaller parallel sub-tasks
- **Status Tracking**: Real-time task status updates via SNS notifications
- **Multi-tenant**: Isolated task queues per tenant
- **Error Handling**: Built-in alarm notifications for failed tasks

## Installation

```bash
npm install @mbc-cqrs-serverless/task
```

## Quick Start

### 1. Register the Module

```typescript
import { Module } from '@nestjs/common';
import { TaskModule, ITaskQueueEventFactory, TaskQueueEvent, StepFunctionTaskEvent } from '@mbc-cqrs-serverless/task';
import { IEvent } from '@mbc-cqrs-serverless/core';

// Implement factory to transform task events into your custom events
class MyTaskQueueEventFactory implements ITaskQueueEventFactory {
  async transformTask(event: TaskQueueEvent): Promise<IEvent[]> {
    // Transform task queue event into your custom events
    return [event];
  }

  async transformStepFunctionTask(event: StepFunctionTaskEvent): Promise<IEvent[]> {
    // Transform step function task event into your custom events
    return [event];
  }
}

@Module({
  imports: [
    TaskModule.register({
      taskQueueEventFactory: MyTaskQueueEventFactory,
      enableController: true, // Optional: enable REST endpoints
    }),
  ],
})
export class AppModule {}
```

### 2. Create and Monitor Tasks

```typescript
import { Injectable } from '@nestjs/common';
import { TaskService, TaskStatusEnum } from '@mbc-cqrs-serverless/task';
import { getUserContext, IInvoke } from '@mbc-cqrs-serverless/core';

@Injectable()
export class BatchService {
  constructor(private readonly taskService: TaskService) {}

  async startBatchProcess(data: any[], opts: { invokeContext: IInvoke }) {
    const { tenantCode } = getUserContext(opts.invokeContext);

    // Create a new task
    const task = await this.taskService.createTask(
      {
        tenantCode,
        taskType: 'BATCH_IMPORT',
        name: 'Import Customer Data',
        input: data,
      },
      opts,
    );

    console.log(task.id);     // Task identifier
    console.log(task.status); // "CREATED"
    console.log(task.code);   // ULID code

    return task;
  }

  async checkStatus(pk: string, sk: string) {
    const task = await this.taskService.getTask({ pk, sk });
    return task.status;
  }
}
```

## API Reference

### TaskService

| Method | Description |
|--------|-------------|
| `createTask(dto, options)` | Create a new async task |
| `createStepFunctionTask(dto, options)` | Create a task for Step Functions workflow |
| `createSubTask(event)` | Create sub-tasks from parent task input |
| `getTask(key)` | Get task by pk/sk |
| `updateStatus(key, status, attributes?, notifyId?)` | Update task status with SNS notification |
| `updateSubTaskStatus(key, status, attributes?, notifyId?)` | Update sub-task status |
| `listItemsByPk(tenantCode, type?, options?)` | List tasks by tenant |
| `getAllSubTask(subTaskKey)` | Get all sub-tasks of a parent task |
| `publishAlarm(event, errorDetails)` | Send alarm notification for failed tasks |

### CreateTaskDto

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `tenantCode` | string | Yes | Tenant identifier |
| `taskType` | string | Yes | Task type identifier |
| `name` | string | No | Human-readable task name |
| `input` | object | Yes | Task input data |

### TaskStatusEnum

| Status | Description |
|--------|-------------|
| `CREATED` | Task created, not yet queued |
| `QUEUED` | Task queued for processing |
| `STARTED` | Task execution started |
| `PROCESSING` | Task is being processed |
| `FINISHED` | Task execution finished |
| `COMPLETED` | Task completed successfully |
| `ERRORED` | Task encountered an error |
| `FAILED` | Task failed permanently |

### TaskEntity

```typescript
{
  id: string;          // Full identifier (pk#sk)
  pk: string;          // Partition key (TASK#tenantCode)
  sk: string;          // Sort key (taskType#taskCode)
  code: string;        // ULID task code
  type: string;        // Task type
  name: string;        // Task name
  tenantCode: string;  // Tenant identifier
  status: string;      // Current status
  input: any;          // Task input data
  attributes?: any;    // Result/error data
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}
```

## Usage Examples

### Standard Task Processing

Create and process tasks with SQS queue:

```typescript
@Injectable()
export class ReportService {
  constructor(private readonly taskService: TaskService) {}

  async generateReport(reportType: string, opts: { invokeContext: IInvoke }) {
    const { tenantCode } = getUserContext(opts.invokeContext);

    // Create task - triggers SNS/SQS workflow
    const task = await this.taskService.createTask(
      {
        tenantCode,
        taskType: 'REPORT_GENERATION',
        name: `Generate ${reportType} Report`,
        input: { reportType, filters: {} },
      },
      opts,
    );

    return { taskId: task.id, status: task.status };
  }
}
```

### Step Functions Task

Create tasks that integrate with AWS Step Functions:

```typescript
@Injectable()
export class WorkflowService {
  constructor(private readonly taskService: TaskService) {}

  async startWorkflow(data: any, opts: { invokeContext: IInvoke }) {
    const { tenantCode } = getUserContext(opts.invokeContext);

    // Create Step Functions task
    const task = await this.taskService.createStepFunctionTask(
      {
        tenantCode,
        taskType: 'ORDER_PROCESSING',
        name: 'Process Order Workflow',
        input: data,
      },
      opts,
    );

    // Task key for Step Functions: SFN_TASK#tenantCode
    return task;
  }
}
```

### Sub-task Processing

Split large tasks into parallel sub-tasks:

```typescript
@Injectable()
export class BulkImportHandler implements IEventHandler<TaskQueueEvent> {
  constructor(private readonly taskService: TaskService) {}

  async handle(event: TaskQueueEvent) {
    // Create sub-tasks from parent task input array
    const subTasks = await this.taskService.createSubTask(event);

    // Each sub-task processes one item from the input array
    console.log(`Created ${subTasks.length} sub-tasks`);

    // Update parent task status
    await this.taskService.updateStatus(
      event.taskEvent.taskKey,
      TaskStatusEnum.PROCESSING,
    );
  }
}
```

### Task Status Updates

Update task status with SNS notifications:

```typescript
@Injectable()
export class TaskProcessor {
  constructor(private readonly taskService: TaskService) {}

  async processTask(pk: string, sk: string) {
    try {
      // Mark as processing
      await this.taskService.updateStatus(
        { pk, sk },
        TaskStatusEnum.PROCESSING,
      );

      // ... do work ...

      // Mark as completed with result
      await this.taskService.updateStatus(
        { pk, sk },
        TaskStatusEnum.COMPLETED,
        { result: { processedCount: 100 } },
      );
    } catch (error) {
      // Mark as failed with error
      await this.taskService.updateStatus(
        { pk, sk },
        TaskStatusEnum.FAILED,
        { error: error.message },
      );
    }
  }
}
```

### List Tasks

Query tasks by tenant and type:

```typescript
@Injectable()
export class TaskDashboard {
  constructor(private readonly taskService: TaskService) {}

  async getTaskList(tenantCode: string) {
    // List standard tasks
    const tasks = await this.taskService.listItemsByPk(
      tenantCode,
      'TASK',
      { limit: 20, order: 'desc' },
    );

    // List Step Function tasks
    const sfnTasks = await this.taskService.listItemsByPk(
      tenantCode,
      'SFN_TASK',
      { limit: 20, order: 'desc' },
    );

    return { tasks: tasks.items, sfnTasks: sfnTasks.items };
  }
}
```

## Event Handlers

The package provides built-in event handlers for task processing:

### TaskQueueEventHandler

Handles task queue events from SQS:

```typescript
import { EventsHandler, IEventHandler } from '@mbc-cqrs-serverless/core';
import { TaskQueueEvent } from '@mbc-cqrs-serverless/task';

@EventsHandler(TaskQueueEvent)
export class MyTaskHandler implements IEventHandler<TaskQueueEvent> {
  async handle(event: TaskQueueEvent) {
    const { taskKey, taskEntity } = event.taskEvent;
    // Process the task...
  }
}
```

### StepFunctionTaskEventHandler

Handles Step Functions task events:

```typescript
import { EventsHandler, IEventHandler } from '@mbc-cqrs-serverless/core';
import { StepFunctionTaskEvent } from '@mbc-cqrs-serverless/task';

@EventsHandler(StepFunctionTaskEvent)
export class MySfnHandler implements IEventHandler<StepFunctionTaskEvent> {
  async handle(event: StepFunctionTaskEvent) {
    const { taskKey } = event;
    // Process the Step Function task...
  }
}
```

## Related Packages

| Package | Description |
|---------|-------------|
| [@mbc-cqrs-serverless/core](https://www.npmjs.com/package/@mbc-cqrs-serverless/core) | Core CQRS framework |
| [@mbc-cqrs-serverless/import](https://www.npmjs.com/package/@mbc-cqrs-serverless/import) | Data import with task processing |

## Documentation

Full documentation available at [https://mbc-cqrs-serverless.mbc-net.com/](https://mbc-cqrs-serverless.mbc-net.com/)

- [Task Service Guide](https://mbc-cqrs-serverless.mbc-net.com/docs/task-service)
- [Step Functions Integration](https://mbc-cqrs-serverless.mbc-net.com/docs/step-functions)

## License

Copyright © 2024-2025, Murakami Business Consulting, Inc. [https://www.mbc-net.com/](https://www.mbc-net.com/)

This project is under the [MIT License](../../LICENSE.txt).
