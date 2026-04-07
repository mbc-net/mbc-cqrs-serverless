import { IEvent } from '@mbc-cqrs-serverless/core'
import {
  SQSMessageAttributes,
  SQSRecord,
  SQSRecordAttributes,
} from 'aws-lambda'

import { ACTION_CSV_BATCH_PROCESS } from '../constant/sqs.constant'
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

  private _payload?: any
  private _importEvent?: ImportEvent

  fromSqsRecord(record: SQSRecord): ImportQueueEvent {
    Object.assign(this, record, { source: record.eventSourceARN })
    return this
  }

  get payload(): any {
    if (!this._payload) {
      let parsed = JSON.parse(this.body)
      if (parsed.Type === 'Notification' && parsed.Message) {
        parsed = JSON.parse(parsed.Message)
      }
      this._payload = parsed
    }
    return this._payload
  }

  get isCsvBatch(): boolean {
    return this.payload?.action === ACTION_CSV_BATCH_PROCESS
  }

  // ----------------------------------------------------------------
  // BACKWARD COMPATIBILITY: Fixes TS2339 & TypeError
  // ----------------------------------------------------------------
  get importEvent(): ImportEvent {
    if (!this._importEvent) {
      // 1. Create a shallow copy of the payload
      const safePayload = { ...this.payload }

      // 2. Delete properties that conflict with ImportEvent's read-only getters
      delete safePayload.tableName
      delete safePayload.action // (Optional) clean up the action tag

      // 3. Safely instantiate
      this._importEvent = new ImportEvent(safePayload)
    }
    return this._importEvent
  }
}
