import { DynamoDBRecord, StreamRecord } from 'aws-lambda'

import { getResourceNameFromArn } from '../helpers'
import { IEvent } from '../interfaces'

export class DataSyncNewCommandEvent implements IEvent, DynamoDBRecord {
  source: string
  awsRegion?: string | undefined
  dynamodb?: StreamRecord | undefined
  eventID?: string | undefined
  eventName?: 'INSERT' | 'MODIFY' | 'REMOVE' | undefined
  eventSource?: string | undefined
  eventSourceARN?: string | undefined
  eventVersion?: string | undefined
  userIdentity?: any

  constructor(event?: Partial<DataSyncNewCommandEvent>) {
    Object.assign(this, event)
  }

  get tableName(): string {
    return getResourceNameFromArn(this.source)
  }

  fromDynamoDBRecord(record: DynamoDBRecord): DataSyncNewCommandEvent {
    Object.assign(this, record, {
      source: record.eventSourceARN,
    })
    return this
  }
}
