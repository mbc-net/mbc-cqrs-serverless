import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { mockClient } from 'aws-sdk-client-mock'
import {
  DeleteMessageBatchCommand,
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageBatchCommand,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs'
import 'aws-sdk-client-mock-jest'
import { SqsService } from './sqs.service'
import { SqsClientFactory } from './sqs-client-factory'

const sqsMock = mockClient(SQSClient)

const QUEUE_URL =
  'https://sqs.ap-northeast-1.amazonaws.com/101010101010/test-queue'

describe('SqsService', () => {
  let service: SqsService

  beforeEach(async () => {
    sqsMock.reset()
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SqsService,
        SqsClientFactory,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'SQS_REGION' ? 'ap-northeast-1' : undefined,
          },
        },
      ],
    }).compile()
    service = module.get<SqsService>(SqsService)
  })

  describe('sendMessage', () => {
    it('should send a single message and return the full output', async () => {
      sqsMock.on(SendMessageCommand).resolves({ MessageId: 'msg-001' })

      const result = await service.sendMessage(QUEUE_URL, 'hello')

      expect(result.MessageId).toBe('msg-001')
      expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
        QueueUrl: QUEUE_URL,
        MessageBody: 'hello',
      })
    })

    it('should forward optional fields', async () => {
      sqsMock.on(SendMessageCommand).resolves({ MessageId: 'msg-002' })

      await service.sendMessage(QUEUE_URL, 'hello', { DelaySeconds: 5 })

      expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
        QueueUrl: QUEUE_URL,
        MessageBody: 'hello',
        DelaySeconds: 5,
      })
    })
  })

  describe('sendMessageBatch', () => {
    it('should send batch and return the full output', async () => {
      sqsMock.on(SendMessageBatchCommand).resolves({
        Successful: [{ Id: '1', MessageId: 'msg-1', MD5OfMessageBody: 'abc' }],
        Failed: [],
      })

      const result = await service.sendMessageBatch(QUEUE_URL, [
        { Id: '1', MessageBody: 'body1' },
      ])

      expect(result.Successful).toHaveLength(1)
      expect(result.Failed).toHaveLength(0)
      expect(sqsMock).toHaveReceivedCommandWith(SendMessageBatchCommand, {
        QueueUrl: QUEUE_URL,
        Entries: [{ Id: '1', MessageBody: 'body1' }],
      })
    })

    it('should return failed entries when some messages fail', async () => {
      sqsMock.on(SendMessageBatchCommand).resolves({
        Successful: [],
        Failed: [
          {
            Id: '1',
            Code: 'InvalidParameterValue',
            Message: 'bad',
            SenderFault: true,
          },
        ],
      })

      const result = await service.sendMessageBatch(QUEUE_URL, [
        { Id: '1', MessageBody: 'bad-body' },
      ])

      expect(result.Failed).toHaveLength(1)
      expect(result.Failed![0].Id).toBe('1')
    })
  })

  describe('receiveMessages', () => {
    it('should return the full output including messages', async () => {
      sqsMock.on(ReceiveMessageCommand).resolves({
        Messages: [
          { MessageId: 'msg-1', Body: 'hello', ReceiptHandle: 'rh-1' },
        ],
      })

      const result = await service.receiveMessages(QUEUE_URL)

      expect(result.Messages).toHaveLength(1)
      expect(result.Messages![0].Body).toBe('hello')
    })

    it('should apply default MaxNumberOfMessages and WaitTimeSeconds', async () => {
      sqsMock.on(ReceiveMessageCommand).resolves({ Messages: [] })

      await service.receiveMessages(QUEUE_URL)

      expect(sqsMock).toHaveReceivedCommandWith(ReceiveMessageCommand, {
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 0,
      })
    })

    it('should forward opts overrides', async () => {
      sqsMock.on(ReceiveMessageCommand).resolves({ Messages: [] })

      await service.receiveMessages(QUEUE_URL, {
        MaxNumberOfMessages: 5,
        WaitTimeSeconds: 20,
      })

      expect(sqsMock).toHaveReceivedCommandWith(ReceiveMessageCommand, {
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 5,
        WaitTimeSeconds: 20,
      })
    })
  })

  describe('deleteMessage', () => {
    it('should call DeleteMessageCommand and return output', async () => {
      sqsMock.on(DeleteMessageCommand).resolves({})

      const result = await service.deleteMessage(
        QUEUE_URL,
        'receipt-handle-abc',
      )

      expect(result).toBeDefined()
      expect(sqsMock).toHaveReceivedCommandWith(DeleteMessageCommand, {
        QueueUrl: QUEUE_URL,
        ReceiptHandle: 'receipt-handle-abc',
      })
    })
  })

  describe('deleteMessageBatch', () => {
    it('should call DeleteMessageBatchCommand and return output', async () => {
      sqsMock.on(DeleteMessageBatchCommand).resolves({
        Successful: [{ Id: '1' }],
        Failed: [],
      })

      const result = await service.deleteMessageBatch(QUEUE_URL, [
        { Id: '1', ReceiptHandle: 'rh-1' },
      ])

      expect(result.Successful).toHaveLength(1)
      expect(result.Failed).toHaveLength(0)
      expect(sqsMock).toHaveReceivedCommandWith(DeleteMessageBatchCommand, {
        QueueUrl: QUEUE_URL,
        Entries: [{ Id: '1', ReceiptHandle: 'rh-1' }],
      })
    })
  })
})
