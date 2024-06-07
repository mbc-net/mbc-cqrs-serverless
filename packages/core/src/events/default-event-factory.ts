import {
  DynamoDBStreamEvent,
  EventBridgeEvent,
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transformSns(event: SNSEvent): Promise<IEvent[]> {
    throw new Error('Method not implemented.')
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    event: EventBridgeEvent<any, any>,
  ): Promise<IEvent[]> {
    throw new Error('Method not implemented.')
  }

  async transformStepFunction(
    event: StepFunctionsEvent<any>,
  ): Promise<IEvent[]> {
    const commandStepFunction = new DataSyncCommandSfnEvent(event)
    return [commandStepFunction]
  }
}
