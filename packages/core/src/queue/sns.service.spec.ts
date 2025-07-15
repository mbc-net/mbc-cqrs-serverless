import { Test, TestingModule } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'
import { SnsService } from './sns.service'
import { ConfigService } from '@nestjs/config'
import { SnsEvent } from './sns.event'
import { SnsClientFactory } from './sns-client-factory'

jest.mock('@aws-sdk/client-sns', () => ({
  PublishCommand: jest.fn().mockImplementation((params) => params),
}))

describe('SnsService', () => {
  let service: SnsService
  let configService: jest.Mocked<ConfigService>
  let snsClientFactory: jest.Mocked<SnsClientFactory>
  let mockClient: any

  const mockSnsEvent: SnsEvent = {
    action: 'TEST_ACTION',
  }

  beforeEach(async () => {
    mockClient = {
      send: jest.fn(),
    }

    jest.clearAllMocks()

    const mockConfigService = createMock<ConfigService>()
    mockConfigService.get.mockReturnValue('arn:aws:sns:us-east-1:123456789012:default-topic')

    const mockSnsClientFactory = createMock<SnsClientFactory>()
    mockSnsClientFactory.getClient.mockReturnValue(mockClient)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SnsService,
        {
          provide: SnsClientFactory,
          useValue: mockSnsClientFactory,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile()

    service = module.get<SnsService>(SnsService)
    configService = module.get(ConfigService)
    snsClientFactory = module.get(SnsClientFactory)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('publish', () => {
    it('should publish message to specified topic ARN', async () => {
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:test-topic'
      
      mockClient.send.mockResolvedValue({
        MessageId: 'test-message-id',
      })

      const result = await service.publish(mockSnsEvent, topicArn)

      expect(snsClientFactory.getClient).toHaveBeenCalledWith(topicArn)
      expect(mockClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          TopicArn: topicArn,
          Message: JSON.stringify(mockSnsEvent),
          MessageAttributes: {
            action: {
              DataType: 'String',
              StringValue: mockSnsEvent.action,
            },
          },
        })
      )
      expect(result).toEqual({
        MessageId: 'test-message-id',
      })
    })

    it('should use default topic ARN when not provided', async () => {
      const defaultTopicArn = 'arn:aws:sns:us-east-1:123456789012:default-topic'
      
      mockClient.send.mockResolvedValue({
        MessageId: 'test-message-id',
      })

      await service.publish(mockSnsEvent)

      expect(snsClientFactory.getClient).toHaveBeenCalledWith(defaultTopicArn)
      expect(mockClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          TopicArn: defaultTopicArn,
        })
      )
    })

    it('should throw error when no topic ARN is provided or configured', async () => {
      configService.get.mockReturnValue(undefined)

      const newModule: TestingModule = await Test.createTestingModule({
        providers: [
          SnsService,
          {
            provide: SnsClientFactory,
            useValue: snsClientFactory,
          },
          {
            provide: ConfigService,
            useValue: configService,
          },
        ],
      }).compile()

      const newService = newModule.get<SnsService>(SnsService)

      expect(() => newService.publish(mockSnsEvent)).toThrow(
        'No topic ARN provided or configured as default.'
      )
    })

    it('should handle publish errors', async () => {
      const topicArn = 'arn:aws:sns:us-east-1:123456789012:test-topic'
      const error = new Error('SNS publish failed')

      mockClient.send.mockRejectedValue(error)

      await expect(service.publish(mockSnsEvent, topicArn)).rejects.toThrow('SNS publish failed')
    })

    it('should serialize complex event objects', async () => {
      const complexEvent: SnsEvent & { data: any } = {
        action: 'COMPLEX_ACTION',
        data: {
          nested: { object: 'value' },
          array: [1, 2, 3],
          boolean: true,
        },
      }

      mockClient.send.mockResolvedValue({
        MessageId: 'test-message-id',
      })

      await service.publish(complexEvent)

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          Message: JSON.stringify(complexEvent),
          MessageAttributes: {
            action: {
              DataType: 'String',
              StringValue: complexEvent.action,
            },
          },
        })
      )
    })

    it('should prefer provided topic ARN over default', async () => {
      const providedTopicArn = 'arn:aws:sns:us-east-1:123456789012:provided-topic'
      
      mockClient.send.mockResolvedValue({
        MessageId: 'test-message-id',
      })

      await service.publish(mockSnsEvent, providedTopicArn)

      expect(snsClientFactory.getClient).toHaveBeenCalledWith(providedTopicArn)
      expect(snsClientFactory.getClient).not.toHaveBeenCalledWith('arn:aws:sns:us-east-1:123456789012:default-topic')
    })
  })
})
