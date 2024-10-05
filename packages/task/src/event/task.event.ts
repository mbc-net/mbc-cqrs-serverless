import { AttributeValue } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import {
  DetailKey,
  getResourceNameFromArn,
  IEvent,
} from '@mbc-cqrs-serverless/core'
import { DynamoDBRecord, StreamRecord } from 'aws-lambda'

import { TaskEntity } from '../entity/task.entity'

export const TASK_EVENT_ACTION = 'task-execute'

export class TaskEvent implements IEvent, DynamoDBRecord {
  source: string
  awsRegion?: string | undefined
  dynamodb?: StreamRecord | undefined
  eventID?: string | undefined
  eventName?: 'INSERT' | 'MODIFY' | 'REMOVE' | undefined
  eventSource?: string | undefined
  eventSourceARN?: string | undefined
  eventVersion?: string | undefined
  userIdentity?: any

  private _taskKey: DetailKey
  private _taskEntity?: TaskEntity

  constructor(event?: Partial<TaskEvent>) {
    Object.assign(this, event)
  }

  get tableName(): string {
    return getResourceNameFromArn(this.source)
  }

  fromDynamoDBRecord(record: DynamoDBRecord): TaskEvent {
    Object.assign(this, record, {
      source: record.eventSourceARN,
    })
    return this
  }

  get taskEntity() {
    if (!this._taskEntity) {
      this._taskEntity = unmarshall(
        this.dynamodb?.NewImage as { [key: string]: AttributeValue },
      ) as TaskEntity
    }

    return this._taskEntity
  }

  get taskKey() {
    if (!this._taskKey) {
      this._taskKey = unmarshall(
        this.dynamodb?.Keys as { [key: string]: AttributeValue },
      ) as DetailKey
    }

    return this._taskKey
  }
}
