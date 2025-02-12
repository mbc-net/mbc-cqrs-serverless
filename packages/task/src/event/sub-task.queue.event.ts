import { IEvent } from '@mbc-cqrs-serverless/core'
import {
  SQSMessageAttributes,
  SQSRecord,
  SQSRecordAttributes,
} from 'aws-lambda'

import { SubTaskEntity } from '../entity'

export class SubTaskQueueEvent implements IEvent, SQSRecord {
  source: string
  messageId: string
  receiptHandle: string
  body: string
  attributes: SQSRecordAttributes
  messageAttributes: SQSMessageAttributes
  md5OfBody: string
  eventSource: string
  eventSourceARN: string
  awsRegion: string

  private _subTaskEntity?: SubTaskEntity

  fromSqsRecord(record: SQSRecord): SubTaskQueueEvent {
    Object.assign(this, record, {
      source: record.eventSourceARN,
    })
    return this
  }

  get subTaskEvent(): SubTaskEntity {
    if (!this._subTaskEntity) {
      const body = JSON.parse(this.body)
      this._subTaskEntity = new SubTaskEntity({
        ...body,
        attributes: body.content.attributes,
        status: body.content.status,
      })
    }

    return this._subTaskEntity
  }
}
