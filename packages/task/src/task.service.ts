import {
  DetailKey,
  DynamoDbService,
  getUserContext,
  IInvoke,
  INotification,
  KEY_SEPARATOR,
  SnsService,
} from '@mbc-cqrs-serverless/core'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ulid } from 'ulid'

import { CreateTaskDto } from './dto/create-task.dto'
import { TaskEntity } from './entity/task.entity'
import { TaskListEntity } from './entity/task-list.entity'
import { TaskStatusEnum } from './enums/status.enum'
import { TaskQueueEvent } from './event'

@Injectable()
export class TaskService {
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
    opts: {
      invokeContext: IInvoke
    },
  ): Promise<TaskEntity> {
    const sourceIp = opts.invokeContext?.event?.requestContext?.http?.sourceIp
    const userContext = getUserContext(opts.invokeContext)

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
      requestId: opts.invokeContext?.context?.awsRequestId,
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

  async listItemsByPk(
    tenantCode: string,
    opts?: {
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
    const pk = `TASK${KEY_SEPARATOR}${tenantCode}`

    const { lastSk, items } = await this.dynamoDbService.listItemsByPk(
      this.tableName,
      pk,
      opts?.sk,
      opts?.startFromSk,
      opts?.limit,
      opts?.order,
    )

    return new TaskListEntity({
      lastSk,
      items: items.map((item) => new TaskEntity(item)),
    })
  }

  async publishAlarm(event: TaskQueueEvent, errorDetails: any): Promise<void> {
    this.logger.debug('event', event)
    const taskKey = event.taskEvent.taskKey
    const alarm: INotification = {
      action: 'sfn-alarm',
      id: `${taskKey.pk}#${taskKey.sk}`,
      table: this.tableName,
      pk: taskKey.pk,
      sk: taskKey.sk,
      tenantCode: taskKey.pk.substring(taskKey.pk.indexOf('#') + 1),
      content: {
        errorMessage: errorDetails,
      },
    }
    this.logger.error('alarm:::', alarm)
    await this.snsService.publish<INotification>(alarm, this.alarmTopicArn)
  }
}
