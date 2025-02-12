import {
  DetailKey,
  DynamoDbService,
  getUserContext,
  IInvoke,
  INotification,
  KEY_SEPARATOR,
  SnsService,
} from '@mbc-cqrs-serverless/core'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ulid } from 'ulid'

import { CreateTaskDto } from './dto/create-task.dto'
import { TaskEntity } from './entity/task.entity'
import { TaskListEntity } from './entity/task-list.entity'
import { TaskStatusEnum } from './enums/status.enum'
import { TaskQueueEvent } from './event'
import { StepFunctionTaskEvent } from './event/task.sfn.event'
import { ITaskService } from './interfaces/task-service.interface'
import { TaskTypesEnum } from './enums'

@Injectable()
export class TaskService implements ITaskService {
  private readonly logger = new Logger(TaskService.name)
  private readonly tableName: string
  private readonly alarmTopicArn: string

  constructor(
    private readonly dynamoDbService: DynamoDbService,
    private readonly snsService: SnsService,
    private readonly config: ConfigService,
  ) {
    this.tableName = dynamoDbService.getTableName('tasks')
    this.alarmTopicArn = this.config.get<string>('SNS_ALARM_TOPIC_ARN')
  }

  async createTask(
    dto: CreateTaskDto,
    options: {
      invokeContext: IInvoke
    },
  ): Promise<TaskEntity> {
    const sourceIp =
      options.invokeContext?.event?.requestContext?.http?.sourceIp
    const userContext = getUserContext(options.invokeContext)

    const taskCode = ulid()
    const pk = `TASK${KEY_SEPARATOR}${dto.tenantCode}`
    const sk = `${dto.taskType}${KEY_SEPARATOR}${taskCode}`

    const item = {
      id: `${pk}${KEY_SEPARATOR}${sk}`,
      pk,
      sk,
      version: 0,
      code: taskCode,
      type: dto.taskType,
      name: dto.name || dto.taskType,
      tenantCode: dto.tenantCode,
      status: TaskStatusEnum.CREATED,
      input: dto.input,
      requestId: options.invokeContext?.context?.awsRequestId,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userContext.userId,
      updatedBy: userContext.userId,
      createdIp: sourceIp,
      updatedIp: sourceIp,
    }

    await this.dynamoDbService.putItem(this.tableName, item)

    return new TaskEntity(item)
  }

  async createStepFunctionTask(
    dto: CreateTaskDto,
    options: {
      invokeContext: IInvoke
    },
  ): Promise<TaskEntity> {
    const sourceIp =
      options.invokeContext?.event?.requestContext?.http?.sourceIp
    const userContext = getUserContext(options.invokeContext)

    const taskCode = ulid()
    const pk = `${TaskTypesEnum.SFN_TASK}${KEY_SEPARATOR}${dto.tenantCode}`
    const sk = `${dto.taskType}${KEY_SEPARATOR}${taskCode}`

    const item = {
      id: `${pk}${KEY_SEPARATOR}${sk}`,
      pk,
      sk,
      version: 0,
      code: taskCode,
      type: dto.taskType,
      name: dto.name || dto.taskType,
      tenantCode: dto.tenantCode,
      status: TaskStatusEnum.CREATED,
      input: dto.input,
      requestId: options.invokeContext?.context?.awsRequestId,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userContext.userId,
      updatedBy: userContext.userId,
      createdIp: sourceIp,
      updatedIp: sourceIp,
    }

    await this.dynamoDbService.putItem(this.tableName, item)

    return new TaskEntity(item)
  }

  async createSubTask(event: TaskQueueEvent): Promise<TaskEntity[]> {
    const subTasks: TaskEntity[] = []
    await Promise.all(
      (event.taskEvent.taskEntity.input as any[]).map((input, index) => {
        const pk = event.taskEvent.taskKey.pk
        const sk = `${event.taskEvent.taskKey.sk}${KEY_SEPARATOR}${index}`

        const taskCode = ulid()

        const item = new TaskEntity({
          id: `${pk}${KEY_SEPARATOR}${sk}`,
          pk,
          sk,
          version: 0,
          code: taskCode,
          type: event.taskEvent.taskEntity.type,
          name: event.taskEvent.taskEntity.name,
          tenantCode: event.taskEvent.taskEntity.tenantCode,
          status: TaskStatusEnum.CREATED,
          input,
          requestId: event.taskEvent.taskEntity.requestId,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: event.taskEvent.taskEntity.createdBy,
          updatedBy: event.taskEvent.taskEntity.updatedBy,
          createdIp: event.taskEvent.taskEntity.createdIp,
          updatedIp: event.taskEvent.taskEntity.updatedIp,
        })

        subTasks.push(item)

        return this.dynamoDbService.putItem(this.tableName, item)
      }),
    )

    return subTasks
  }

  async getAllSubTask(subTask: DetailKey): Promise<TaskEntity[]> {
    const parentKey = subTask.sk
      .split(KEY_SEPARATOR)
      .slice(0, -1)
      .join(KEY_SEPARATOR)
    const res = await this.dynamoDbService.listItemsByPk(
      this.tableName,
      subTask.pk,
      {
        skExpession: 'begins_with(sk, :typeCode)',
        skAttributeValues: {
          ':typeCode': `${parentKey}${KEY_SEPARATOR}`,
        },
      },
    )

    return (res?.items || []).map((item) => new TaskEntity(item))
  }

  async updateStepFunctionTask(
    key: DetailKey,
    attributes?: Record<string, any>,
    status?: string,
    notifyId?: string,
  ) {
    await this.dynamoDbService.updateItem(this.tableName, key, {
      set: { attributes, status },
    })

    // notification via SNS
    await this.snsService.publish<INotification>({
      action: 'task-status',
      ...key,
      table: this.tableName,
      id: notifyId || `${key.pk}#${key.sk}`,
      tenantCode: key.pk.substring(key.pk.indexOf('#') + 1),
      content: { attributes, status },
    })
  }

  async getTask(key: DetailKey): Promise<TaskEntity> {
    const item = await this.dynamoDbService.getItem(this.tableName, key)
    return new TaskEntity(item)
  }

  async updateStatus(
    key: DetailKey,
    status: string,
    attributes?: { result?: any; error?: any },
    notifyId?: string,
  ) {
    await this.dynamoDbService.updateItem(this.tableName, key, {
      set: { status, attributes },
    })

    // notification via SNS
    await this.snsService.publish<INotification>({
      action: 'task-status',
      ...key,
      table: this.tableName,
      id: notifyId || `${key.pk}#${key.sk}`,
      tenantCode: key.pk.substring(key.pk.indexOf('#') + 1),
      content: { status, attributes },
    })
  }

  async updateSubTaskStatus(
    key: DetailKey,
    status: string,
    attributes?: { result?: any; error?: any },
    notifyId?: string,
  ) {
    await this.dynamoDbService.updateItem(this.tableName, key, {
      set: { status, attributes },
    })

    // notification via SNS -> insert to queue
    await this.snsService.publish<INotification>({
      action: 'sub-task-status',
      ...key,
      table: this.tableName,
      id: notifyId || `${key.pk}#${key.sk}`,
      tenantCode: key.pk.substring(key.pk.indexOf('#') + 1),
      content: { status, attributes },
    })
  }

  async listItemsByPk(
    tenantCode: string,
    type?: string,
    options?: {
      sk?: {
        skExpession: string
        skAttributeValues: Record<string, string>
        skAttributeNames?: Record<string, string>
      }
      startFromSk?: string
      limit?: number
      order?: 'asc' | 'desc'
    },
  ): Promise<TaskListEntity> {
    if (!['TASK', 'SFN_TASK'].includes(type)) {
      throw new NotFoundException(
        `The type of task, must be either "TASK" or "SFN_TASK"`,
      )
    }
    const pk = `${type}${KEY_SEPARATOR}${tenantCode}`

    const { lastSk, items } = await this.dynamoDbService.listItemsByPk(
      this.tableName,
      pk,
      options?.sk,
      options?.startFromSk,
      options?.limit,
      options?.order,
    )

    return new TaskListEntity({
      lastSk,
      items: items.map((item) => new TaskEntity(item)),
    })
  }

  async publishAlarm(
    event: TaskQueueEvent | StepFunctionTaskEvent,
    errorDetails: any,
  ): Promise<void> {
    this.logger.debug('event', event)
    const taskKey =
      event instanceof TaskQueueEvent ? event.taskEvent.taskKey : event.taskKey
    const tenantCode = taskKey.pk.substring(
      taskKey.pk.indexOf(KEY_SEPARATOR) + 1,
    )

    const alarm: INotification = {
      action: 'sfn-alarm',
      id: `${taskKey.pk}#${taskKey.sk}`,
      table: this.tableName,
      pk: taskKey.pk,
      sk: taskKey.sk,
      tenantCode,
      content: {
        errorMessage: errorDetails,
      },
    }
    this.logger.error('alarm:::', alarm)
    await this.snsService.publish<INotification>(alarm, this.alarmTopicArn)
  }

  async formatTaskStatus(tasks: TaskEntity[]) {
    const result = {
      subTaskCount: tasks.length,
      subTaskSucceedCount: this.countTaskStatus(
        tasks,
        TaskStatusEnum.COMPLETED,
      ),
      subTaskFailedCount: this.countTaskStatus(tasks, TaskStatusEnum.FAILED),
      subTaskRunningCount: this.countTaskStatus(
        tasks,
        TaskStatusEnum.PROCESSING,
      ),
      subTasks: tasks.map((task) => ({
        pk: task.pk,
        sk: task.sk,
        status: task.status,
      })),
    }

    return result
  }

  private countTaskStatus(tasks: TaskEntity[], status: TaskStatusEnum) {
    return tasks.filter((task) => task.status === status).length
  }
}
