import {
  DynamoDBStreamEvent,
  EventBridgeEvent,
  SNSEvent,
  SQSEvent,
} from 'aws-lambda'

import { StepFunctionsEvent } from './aws/step-function.interface'
import { IEvent } from './event.interface'

export interface IEventFactory<TEvent extends IEvent = any> {
  transformSqs(event: SQSEvent): Promise<TEvent[]>

  transformSns(event: SNSEvent): Promise<TEvent[]>

  transformDynamodbStream(event: DynamoDBStreamEvent): Promise<TEvent[]>

  transformEventBridge(event: EventBridgeEvent<any, any>): Promise<TEvent[]>

  transformStepFunction(event: StepFunctionsEvent<any>): Promise<TEvent[]>
}
