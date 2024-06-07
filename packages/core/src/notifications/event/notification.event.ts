import {
  SQSMessageAttributes,
  SQSRecord,
  SQSRecordAttributes,
} from 'aws-lambda'

import { IEvent } from '../../interfaces'

export class NotificationEvent implements IEvent, SQSRecord {
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

  fromSqsRecord(record: SQSRecord): NotificationEvent {
    Object.assign(this, record, {
      source: record.eventSourceARN,
    })
    return this
  }
}
