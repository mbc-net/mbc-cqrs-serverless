import { Body, Controller, Logger, Post, UseFilters } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import {
  DynamoDBStreamEvent,
  EventBridgeEvent,
  S3Event,
  SNSEvent,
  SQSEvent,
} from 'aws-lambda'

import { EventSourceException } from '../exceptions'
import { EventSourceExceptionFilter } from '../filters'
import { StepFunctionsEvent } from '../interfaces'
import { EventService } from './event.services'

@Controller()
@UseFilters(new EventSourceExceptionFilter())
@ApiExcludeController()
export class EventController {
  private readonly logger = new Logger(EventController.name)

  constructor(private readonly eventService: EventService) {}

  @Post('sns')
  async handleSnsEvent(@Body() event: SNSEvent) {
    try {
      return await this.eventService.handleSnsEvent(event)
    } catch (error) {
      this.logger.error(error)
      throw new EventSourceException(error as Error)
    }
  }

  @Post('sqs')
  async handleSqsEvent(@Body() event: SQSEvent) {
    try {
      return await this.eventService.handleSqsEvent(event)
    } catch (error) {
      this.logger.error(error)
      throw new EventSourceException(error as Error)
    }
  }

  @Post('dynamodb')
  async handleDynamoDBEvent(@Body() event: DynamoDBStreamEvent) {
    try {
      return await this.eventService.handleDynamoDBEvent(event)
    } catch (error) {
      this.logger.error(error)
      throw new EventSourceException(error as Error)
    }
  }

  @Post('event-bridge')
  async handleEventBridgeEvent(@Body() event: EventBridgeEvent<any, any>) {
    try {
      return await this.eventService.handleEventBridgeEvent(event)
    } catch (error) {
      this.logger.error(error)
      throw new EventSourceException(error as Error)
    }
  }

  @Post('step-functions')
  async handleStepFunctionsEvent(@Body() event: StepFunctionsEvent<any>) {
    try {
      return await this.eventService.handleStepFunctionsEvent(event)
    } catch (error) {
      this.logger.error(error)
      throw new EventSourceException(error as Error)
    }
  }

  @Post('s3')
  async handleS3Event(@Body() event: S3Event) {
    try {
      return await this.eventService.handleS3Event(event)
    } catch (error) {
      this.logger.error(error)
      throw new EventSourceException(error as Error)
    }
  }
}
