import { Test, TestingModule } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'
import { Logger } from '@nestjs/common'
import {
  DynamoDBStreamEvent,
  EventBridgeEvent,
  S3Event,
  SNSEvent,
  SQSEvent,
} from 'aws-lambda'

import { EventService } from './event.services'
import { EventBus } from './event-bus'
import { DefaultEventFactory } from './default-event-factory'
import { IEvent, IEventFactory, StepFunctionsEvent } from '../interfaces'

describe('EventService', () => {
  let service: EventService
  let eventBus: jest.Mocked<EventBus>
  let mockEventFactory: jest.Mocked<IEventFactory>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        {
          provide: EventBus,
          useValue: createMock<EventBus>(),
        },
      ],
    }).compile()

    service = module.get<EventService>(EventService)
    eventBus = module.get(EventBus)
    mockEventFactory = createMock<IEventFactory>()

    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('eventFactory getter/setter', () => {
    it('should return the current event factory', () => {
      const factory = service.eventFactory
      expect(factory).toBeInstanceOf(DefaultEventFactory)
    })

    it('should set a new event factory', () => {
      service.eventFactory = mockEventFactory
      expect(service.eventFactory).toBe(mockEventFactory)
    })
  })

  describe('setDefaultEventFactory', () => {
    it('should set the default event factory', () => {
      service.eventFactory = mockEventFactory
      service.setDefaultEventFactory()
      expect(service.eventFactory).toBeInstanceOf(DefaultEventFactory)
    })
  })

  describe('handleSnsEvent', () => {
    it('should handle SNS event successfully', async () => {
      const mockSnsEvent: SNSEvent = {
        Records: [
          {
            EventSource: 'aws:sns',
            EventVersion: '1.0',
            EventSubscriptionArn: 'arn:aws:sns:us-east-1:123456789012:test-topic',
            Sns: {
              Type: 'Notification',
              MessageId: 'test-message-id',
              TopicArn: 'arn:aws:sns:us-east-1:123456789012:test-topic',
              Subject: 'Test Subject',
              Message: 'Test Message',
              Timestamp: '2023-01-01T00:00:00.000Z',
              SignatureVersion: '1',
              Signature: 'test-signature',
              SigningCertUrl: 'https://test-cert-url',
              UnsubscribeUrl: 'https://test-unsubscribe-url',
              MessageAttributes: {},
            },
          },
        ],
      }

      const mockEvents: IEvent[] = [{ source: 'sns' }]
      service.eventFactory = mockEventFactory
      mockEventFactory.transformSns.mockResolvedValue(mockEvents)
      eventBus.execute.mockResolvedValue(['result'])

      const result = await service.handleSnsEvent(mockSnsEvent)

      expect(mockEventFactory.transformSns).toHaveBeenCalledWith(mockSnsEvent)
      expect(eventBus.execute).toHaveBeenCalledWith({ source: 'sns' })
      expect(result).toEqual([['result']])
    })

    it('should handle SNS event transformation errors', async () => {
      const mockSnsEvent: SNSEvent = { Records: [] }
      const error = new Error('Transform failed')

      service.eventFactory = mockEventFactory
      mockEventFactory.transformSns.mockRejectedValue(error)

      await expect(service.handleSnsEvent(mockSnsEvent)).rejects.toThrow('Transform failed')
    })
  })

  describe('handleSqsEvent', () => {
    it('should handle SQS event successfully', async () => {
      const mockSqsEvent: SQSEvent = {
        Records: [
          {
            messageId: 'test-message-id',
            receiptHandle: 'test-receipt-handle',
            body: 'test-body',
            attributes: {
              ApproximateReceiveCount: '1',
              SentTimestamp: '1640995200000',
              SenderId: 'test-sender-id',
              ApproximateFirstReceiveTimestamp: '1640995200000',
            },
            messageAttributes: {},
            md5OfBody: 'test-md5',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
            awsRegion: 'us-east-1',
          },
        ],
      }

      const mockEvents: IEvent[] = [{ source: 'sqs' }]
      service.eventFactory = mockEventFactory
      mockEventFactory.transformSqs.mockResolvedValue(mockEvents)
      eventBus.execute.mockResolvedValue(['result'])

      const result = await service.handleSqsEvent(mockSqsEvent)

      expect(mockEventFactory.transformSqs).toHaveBeenCalledWith(mockSqsEvent)
      expect(eventBus.execute).toHaveBeenCalledWith({ source: 'sqs' })
      expect(result).toEqual([['result']])
    })
  })

  describe('handleDynamoDBEvent', () => {
    it('should handle DynamoDB stream event successfully', async () => {
      const mockDynamoDBEvent: DynamoDBStreamEvent = {
        Records: [
          {
            eventID: 'test-event-id',
            eventName: 'INSERT',
            eventVersion: '1.1',
            eventSource: 'aws:dynamodb',
            awsRegion: 'us-east-1',
            dynamodb: {
              ApproximateCreationDateTime: 1640995200,
              Keys: {
                pk: { S: 'test-pk' },
                sk: { S: 'test-sk' },
              },
              NewImage: {
                pk: { S: 'test-pk' },
                sk: { S: 'test-sk' },
                data: { S: 'test-data' },
              },
              SequenceNumber: '123456789',
              SizeBytes: 100,
              StreamViewType: 'NEW_AND_OLD_IMAGES',
            },
            eventSourceARN: 'arn:aws:dynamodb:us-east-1:123456789012:table/test-table/stream/test-stream',
          },
        ],
      }

      const mockEvents: IEvent[] = [{ source: 'dynamodb' }]
      service.eventFactory = mockEventFactory
      mockEventFactory.transformDynamodbStream.mockResolvedValue(mockEvents)
      eventBus.execute.mockResolvedValue(['result'])

      const result = await service.handleDynamoDBEvent(mockDynamoDBEvent)

      expect(mockEventFactory.transformDynamodbStream).toHaveBeenCalledWith(mockDynamoDBEvent)
      expect(eventBus.execute).toHaveBeenCalledWith({ source: 'dynamodb' })
      expect(result).toEqual([['result']])
    })
  })

  describe('handleEventBridgeEvent', () => {
    it('should handle EventBridge event successfully', async () => {
      const mockEventBridgeEvent: EventBridgeEvent<any, any> = {
        version: '0',
        id: 'test-event-id',
        'detail-type': 'Test Event',
        source: 'test.application',
        account: '123456789012',
        time: '2023-01-01T00:00:00Z',
        region: 'us-east-1',
        detail: {
          key: 'value',
        },
        resources: [],
      }

      const mockEvents: IEvent[] = [{ source: 'eventbridge' }]
      service.eventFactory = mockEventFactory
      mockEventFactory.transformEventBridge.mockResolvedValue(mockEvents)
      eventBus.execute.mockResolvedValue(['result'])

      const result = await service.handleEventBridgeEvent(mockEventBridgeEvent)

      expect(mockEventFactory.transformEventBridge).toHaveBeenCalledWith(mockEventBridgeEvent)
      expect(eventBus.execute).toHaveBeenCalledWith({ source: 'eventbridge' })
      expect(result).toEqual([['result']])
    })
  })

  describe('handleStepFunctionsEvent', () => {
    it('should handle Step Functions event successfully', async () => {
      const mockStepFunctionsEvent: StepFunctionsEvent<any> = {
        input: {
          key: 'value',
        },
        context: {
          Execution: {
            Id: 'test-execution-id',
            Input: {},
            Name: 'test-execution',
            RoleArn: 'arn:aws:iam::123456789012:role/test-role',
            StartTime: '2023-01-01T00:00:00.000Z',
          },
          StateMachine: {
            Id: 'test-state-machine-id',
            Name: 'test-state-machine',
          },
          State: {
            EnteredTime: '2023-01-01T00:00:00.000Z',
            Name: 'TestState',
            RetryCount: 0,
          },
        },
      }

      const mockEvents: IEvent[] = [{ source: 'stepfunctions' }]
      service.eventFactory = mockEventFactory
      mockEventFactory.transformStepFunction.mockResolvedValue(mockEvents)
      eventBus.execute.mockResolvedValue(['result'])

      const result = await service.handleStepFunctionsEvent(mockStepFunctionsEvent)

      expect(mockEventFactory.transformStepFunction).toHaveBeenCalledWith(mockStepFunctionsEvent)
      expect(eventBus.execute).toHaveBeenCalledWith({ source: 'stepfunctions' })
      expect(result).toEqual([['result']])
    })
  })

  describe('handleS3Event', () => {
    it('should handle S3 event successfully', async () => {
      const mockS3Event: S3Event = {
        Records: [
          {
            eventVersion: '2.1',
            eventSource: 'aws:s3',
            awsRegion: 'us-east-1',
            eventTime: '2023-01-01T00:00:00.000Z',
            eventName: 's3:ObjectCreated:Put',
            userIdentity: {
              principalId: 'test-principal-id',
            },
            requestParameters: {
              sourceIPAddress: '127.0.0.1',
            },
            responseElements: {
              'x-amz-request-id': 'test-request-id',
              'x-amz-id-2': 'test-id-2',
            },
            s3: {
              s3SchemaVersion: '1.0',
              configurationId: 'test-config-id',
              bucket: {
                name: 'test-bucket',
                ownerIdentity: {
                  principalId: 'test-principal-id',
                },
                arn: 'arn:aws:s3:::test-bucket',
              },
              object: {
                key: 'test-object-key',
                size: 1024,
                eTag: 'test-etag',
                sequencer: 'test-sequencer',
              },
            },
          },
        ],
      }

      const mockEvents: IEvent[] = [{ source: 's3' }]
      service.eventFactory = mockEventFactory
      mockEventFactory.transformS3.mockResolvedValue(mockEvents)
      eventBus.execute.mockResolvedValue(['result'])

      const result = await service.handleS3Event(mockS3Event)

      expect(mockEventFactory.transformS3).toHaveBeenCalledWith(mockS3Event)
      expect(eventBus.execute).toHaveBeenCalledWith({ source: 's3' })
      expect(result).toEqual([['result']])
    })
  })

  describe('execute', () => {
    it('should execute multiple events in parallel', async () => {
      const mockEvents: IEvent[] = [
        { source: 'event1' },
        { source: 'event2' },
        { source: 'event3' },
      ]

      eventBus.execute
        .mockResolvedValueOnce(['result1'])
        .mockResolvedValueOnce(['result2'])
        .mockResolvedValueOnce(['result3'])

      const result = await service['execute'](mockEvents)

      expect(eventBus.execute).toHaveBeenCalledTimes(3)
      expect(eventBus.execute).toHaveBeenNthCalledWith(1, { source: 'event1' })
      expect(eventBus.execute).toHaveBeenNthCalledWith(2, { source: 'event2' })
      expect(eventBus.execute).toHaveBeenNthCalledWith(3, { source: 'event3' })
      expect(result).toEqual([['result1'], ['result2'], ['result3']])
    })

    it('should handle execution errors', async () => {
      const mockEvents: IEvent[] = [{ source: 'event1' }]
      const error = new Error('Execution failed')

      eventBus.execute.mockRejectedValue(error)

      await expect(service['execute'](mockEvents)).rejects.toThrow('Execution failed')
    })

    it('should handle empty events array', async () => {
      const mockEvents: IEvent[] = []

      const result = await service['execute'](mockEvents)

      expect(eventBus.execute).not.toHaveBeenCalled()
      expect(result).toEqual([])
    })
  })

  describe('logger integration', () => {
    it('should log debug messages for each event handler', async () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation()

      const mockSnsEvent: SNSEvent = { Records: [] }
      service.eventFactory = mockEventFactory
      mockEventFactory.transformSns.mockResolvedValue([])

      await service.handleSnsEvent(mockSnsEvent)

      expect(loggerSpy).toHaveBeenCalledWith('handleSnsEvent::', mockSnsEvent)

      loggerSpy.mockRestore()
    })
  })
})
