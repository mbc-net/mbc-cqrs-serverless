import {
  DynamoDBStreamEvent,
  EventBridgeEvent,
  S3Event,
  SNSEvent,
  SQSEvent,
} from 'aws-lambda'

import { DataSyncNewCommandEvent } from '../command-events/data-sync.new.event'
import { DataSyncCommandSfnEvent } from '../command-events/data-sync.sfn.event'
import { COMMAND_TABLE_SUFFIX, DEFAULT_NOTIFICATION_QUEUE } from '../constants'
import { IEvent, IEventFactory, StepFunctionsEvent } from '../interfaces'
import { NotificationEvent } from '../notifications/event/notification.event'

export class DefaultEventFactory implements IEventFactory {
  async transformSqs(event: SQSEvent): Promise<IEvent[]> {
    const events = event.Records.map((record) => {
      if (record.eventSourceARN.endsWith(DEFAULT_NOTIFICATION_QUEUE)) {
        return new NotificationEvent().fromSqsRecord(record)
      }
      return undefined
    }).filter((event) => !!event)

    return events
  }

  async transformSns(event: SNSEvent): Promise<IEvent[]> {
    return event.Records.map((record) => ({
      ...record,
      source: record.EventSource,
    }))
  }

  async transformDynamodbStream(event: DynamoDBStreamEvent): Promise<IEvent[]> {
    const events = event.Records.map((record) => {
      if (
        record.eventSourceARN.endsWith(COMMAND_TABLE_SUFFIX) ||
        record.eventSourceARN.includes(COMMAND_TABLE_SUFFIX + '/stream/')
      ) {
        if (record.eventName === 'INSERT') {
          return new DataSyncNewCommandEvent().fromDynamoDBRecord(record)
        }
      }
      return undefined
    }).filter((event) => !!event)

    return events
  }

  async transformEventBridge(
    event: EventBridgeEvent<any, any>,
  ): Promise<IEvent[]> {
    return [event]
  }

  async transformStepFunction(
    event: StepFunctionsEvent<any>,
  ): Promise<IEvent[]> {
    const commandStepFunction = new DataSyncCommandSfnEvent(event)
    return [commandStepFunction]
  }

  async transformS3(event: S3Event): Promise<IEvent[]> {
    return event.Records.map((record) => ({
      ...record,
      source: record.eventSource,
    }))
  }
}
