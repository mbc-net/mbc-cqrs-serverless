import { IEvent } from '@mbc-cqrs-serverless/core'
import {
  SQSMessageAttributes,
  SQSRecord,
  SQSRecordAttributes,
} from 'aws-lambda'

import { ImportEvent } from './import.event'

export class ImportQueueEvent implements IEvent, SQSRecord {
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

  private _importEvent?: ImportEvent

  fromSqsRecord(record: SQSRecord): ImportQueueEvent {
    Object.assign(this, record, {
      source: record.eventSourceARN,
    })
    return this
  }

  get importEvent(): ImportEvent {
    if (!this._importEvent) {
      this._importEvent = new ImportEvent(JSON.parse(this.body))
    }

    return this._importEvent
  }
}
