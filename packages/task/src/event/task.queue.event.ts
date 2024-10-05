import { IEvent } from '@mbc-cqrs-sererless/core'
import {
  SQSMessageAttributes,
  SQSRecord,
  SQSRecordAttributes,
} from 'aws-lambda'

import { TaskEvent } from './task.event'

export class TaskQueueEvent implements IEvent, SQSRecord {
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

  private _taskEvent?: TaskEvent

  fromSqsRecord(record: SQSRecord): TaskQueueEvent {
    Object.assign(this, record, {
      source: record.eventSourceARN,
    })
    return this
  }

  get taskEvent(): TaskEvent {
    if (!this._taskEvent) {
      this._taskEvent = new TaskEvent(JSON.parse(this.body))
    }

    return this._taskEvent
  }
}
