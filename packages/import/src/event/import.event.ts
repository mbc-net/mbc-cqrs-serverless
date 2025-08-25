import { AttributeValue } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import {
  DetailKey,
  getResourceNameFromArn,
  IEvent,
} from '@mbc-cqrs-serverless/core'
import { DynamoDBRecord, StreamRecord } from 'aws-lambda'

import { ImportEntity } from '../entity/import-entity'

export const IMPORT_EVENT_ACTION = 'import-execute'

export class ImportEvent implements IEvent, DynamoDBRecord {
  source: string
  awsRegion?: string | undefined
  dynamodb?: StreamRecord | undefined
  eventID?: string | undefined
  eventName?: 'INSERT' | 'MODIFY' | 'REMOVE' | undefined
  eventSource?: string | undefined
  eventSourceARN?: string | undefined
  eventVersion?: string | undefined
  userIdentity?: any

  private _importKey: DetailKey
  private _importEntity?: ImportEntity

  constructor(event?: Partial<ImportEvent>) {
    Object.assign(this, event)
  }

  get tableName(): string {
    return getResourceNameFromArn(this.source)
  }

  fromDynamoDBRecord(record: DynamoDBRecord): ImportEvent {
    Object.assign(this, record, {
      source: record.eventSourceARN,
    })
    return this
  }

  get importEntity() {
    if (!this._importEntity) {
      this._importEntity = unmarshall(
        this.dynamodb?.NewImage as { [key: string]: AttributeValue },
      ) as ImportEntity
    }

    return this._importEntity
  }

  get importKey() {
    if (!this._importKey) {
      this._importKey = unmarshall(
        this.dynamodb?.Keys as { [key: string]: AttributeValue },
      ) as DetailKey
    }

    return this._importKey
  }
}
