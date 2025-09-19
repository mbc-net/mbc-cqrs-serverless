import { IEvent } from '@mbc-cqrs-serverless/core'
import {
  SQSMessageAttributes,
  SQSRecord,
  SQSRecordAttributes,
} from 'aws-lambda'

export class ImportStatusQueueEvent implements IEvent, SQSRecord {
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

  fromSqsRecord(record: SQSRecord): ImportStatusQueueEvent {
    Object.assign(this, record, {
      source: record.eventSourceARN,
    })
    return this
  }
}
