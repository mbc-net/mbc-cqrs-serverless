import { getCurrentInvoke } from '@codegenie/serverless-express'
import {
  DetailKey,
  DynamoDbService,
  getUserContext,
  INotification,
  KEY_SEPARATOR,
  SnsService,
} from '@mbc-cqrs-severless/core'
import { Injectable, Logger } from '@nestjs/common'
import { ulid } from 'ulid'

import { CreateTaskDto } from './dto/create-task.dto'
import { TaskEntity } from './entity/task.entity'
import { TaskListEntity } from './entity/task-list.entity'
import { TaskStatusEnum } from './enums/status.enum'

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name)
  private readonly tableName: string

  constructor(
    private readonly dynamoDbService: DynamoDbService,
    private readonly snsService: SnsService,
  ) {
    this.tableName = dynamoDbService.getTableName('tasks')
  }

  async createTask(dto: CreateTaskDto): Promise<TaskEntity> {
    const { event, context } = getCurrentInvoke()
    const userContext = getUserContext(event)

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
      requestId: context?.awsRequestId,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userContext.userId,
      updatedBy: userContext.userId,
      createdIp: event?.requestContext?.http?.sourceIp,
      updatedIp: event?.requestContext?.http?.sourceIp,
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
}
