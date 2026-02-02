import {
  DynamoDBStreamEvent,
  EventBridgeEvent,
  S3Event,
  SNSEvent,
  SQSEvent,
} from 'aws-lambda'

import { StepFunctionsEvent } from './aws/step-function.interface'
import { IEvent } from './event.interface'

/**
 * Factory interface for transforming AWS events into domain events.
 * Implement this to customize how incoming AWS events are parsed.
 *
 * Each transform method receives the raw AWS event and returns
 * an array of domain events to be processed by handlers.
 */
export interface IEventFactory<TEvent extends IEvent = any> {
  /** Transform SQS messages into domain events */
  transformSqs(event: SQSEvent): Promise<TEvent[]>

  /** Transform SNS notifications into domain events */
  transformSns(event: SNSEvent): Promise<TEvent[]>

  /** Transform DynamoDB Stream records into domain events */
  transformDynamodbStream(event: DynamoDBStreamEvent): Promise<TEvent[]>

  /** Transform EventBridge events into domain events */
  transformEventBridge(event: EventBridgeEvent<any, any>): Promise<TEvent[]>

  /** Transform Step Functions task input into domain events */
  transformStepFunction(event: StepFunctionsEvent<any>): Promise<TEvent[]>

  /** Transform S3 notifications into domain events */
  transformS3(event: S3Event): Promise<TEvent[]>
}
