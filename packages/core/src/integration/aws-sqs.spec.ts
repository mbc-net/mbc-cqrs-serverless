/**
 * AWS SQS Client Integration Tests
 *
 * This file tests the AWS SDK SQS client commands using aws-sdk-client-mock.
 * It covers input parameters (IN) and return values (OUT) for each command.
 */
import {
  DeleteMessageCommand,
  QueueAttributeName,
  ReceiveMessageCommand,
  SendMessageBatchCommand,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs'
import { mockClient } from 'aws-sdk-client-mock'
import 'aws-sdk-client-mock-jest'

describe('AWS SQS Client Commands', () => {
  const sqsMock = mockClient(SQSClient)
  const client = new SQSClient({ region: 'ap-northeast-1' })

  beforeEach(() => {
    sqsMock.reset()
  })

  afterEach(() => {
    sqsMock.reset()
  })

  // ============================================================================
  // SendMessageCommand Tests
  // ============================================================================
  describe('SendMessageCommand', () => {
    describe('Input Parameters - QueueUrl, MessageBody, DelaySeconds', () => {
      it('should send SendMessageCommand with QueueUrl and MessageBody', async () => {
        // Arrange
        sqsMock.on(SendMessageCommand).resolves({
          MessageId: 'test-message-id',
          MD5OfMessageBody: 'abc123',
        })

        const params = {
          QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
          MessageBody: JSON.stringify({ action: 'TEST', data: 'value' }),
        }

        // Act
        await client.send(new SendMessageCommand(params))

        // Assert
        expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
          QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
          MessageBody: JSON.stringify({ action: 'TEST', data: 'value' }),
        })
      })

      it('should send SendMessageCommand with DelaySeconds', async () => {
        // Arrange
        sqsMock.on(SendMessageCommand).resolves({
          MessageId: 'delayed-message-id',
        })

        const params = {
          QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
          MessageBody: 'Delayed message',
          DelaySeconds: 60, // 1 minute delay
        }

        // Act
        await client.send(new SendMessageCommand(params))

        // Assert
        expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
          DelaySeconds: 60,
        })
      })

      it('should send SendMessageCommand with MessageAttributes', async () => {
        // Arrange
        sqsMock.on(SendMessageCommand).resolves({
          MessageId: 'attr-message-id',
          MD5OfMessageAttributes: 'def456',
        })

        const params = {
          QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
          MessageBody: JSON.stringify({ action: 'CREATE' }),
          MessageAttributes: {
            action: {
              DataType: 'String',
              StringValue: 'CREATE',
            },
            priority: {
              DataType: 'Number',
              StringValue: '1',
            },
            timestamp: {
              DataType: 'Number',
              StringValue: Date.now().toString(),
            },
          },
        }

        // Act
        await client.send(new SendMessageCommand(params))

        // Assert
        expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
          MessageAttributes: {
            action: {
              DataType: 'String',
              StringValue: 'CREATE',
            },
            priority: {
              DataType: 'Number',
              StringValue: '1',
            },
            timestamp: expect.objectContaining({
              DataType: 'Number',
            }),
          },
        })
      })

      it('should send SendMessageCommand with MessageSystemAttributes', async () => {
        // Arrange
        sqsMock.on(SendMessageCommand).resolves({
          MessageId: 'sys-attr-message-id',
        })

        const params = {
          QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
          MessageBody: 'Message with system attributes',
          MessageSystemAttributes: {
            AWSTraceHeader: {
              DataType: 'String',
              StringValue: 'Root=1-5f4a0a0a-0000000000000000;Parent=0000000000000000;Sampled=1',
            },
          },
        }

        // Act
        await client.send(new SendMessageCommand(params))

        // Assert
        expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
          MessageSystemAttributes: expect.objectContaining({
            AWSTraceHeader: expect.objectContaining({
              DataType: 'String',
            }),
          }),
        })
      })

      it('should send SendMessageCommand to FIFO queue with MessageGroupId', async () => {
        // Arrange
        sqsMock.on(SendMessageCommand).resolves({
          MessageId: 'fifo-message-id',
          SequenceNumber: '10000000000000000001',
        })

        const params = {
          QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue.fifo',
          MessageBody: 'FIFO message',
          MessageGroupId: 'group-1',
          MessageDeduplicationId: 'dedup-123',
        }

        // Act
        await client.send(new SendMessageCommand(params))

        // Assert
        expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
          MessageGroupId: 'group-1',
          MessageDeduplicationId: 'dedup-123',
        })
      })
    })

    describe('Return Values - MessageId', () => {
      it('should return MessageId on successful send', async () => {
        // Arrange
        const expectedMessageId = 'abc123-def456-ghi789'
        sqsMock.on(SendMessageCommand).resolves({
          MessageId: expectedMessageId,
          MD5OfMessageBody: 'md5hash123',
        })

        // Act
        const result = await client.send(
          new SendMessageCommand({
            QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
            MessageBody: 'Test message',
          }),
        )

        // Assert
        expect(result.MessageId).toBe(expectedMessageId)
        expect(result.MD5OfMessageBody).toBe('md5hash123')
      })

      it('should return SequenceNumber for FIFO queues', async () => {
        // Arrange
        sqsMock.on(SendMessageCommand).resolves({
          MessageId: 'fifo-message-id',
          SequenceNumber: '10000000000000000001',
          MD5OfMessageBody: 'md5fifo',
        })

        // Act
        const result = await client.send(
          new SendMessageCommand({
            QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue.fifo',
            MessageBody: 'FIFO message',
            MessageGroupId: 'group-1',
          }),
        )

        // Assert
        expect(result.MessageId).toBe('fifo-message-id')
        expect(result.SequenceNumber).toBe('10000000000000000001')
      })

      it('should return MD5OfMessageAttributes when attributes provided', async () => {
        // Arrange
        sqsMock.on(SendMessageCommand).resolves({
          MessageId: 'attr-msg-id',
          MD5OfMessageBody: 'bodyhash',
          MD5OfMessageAttributes: 'attrhash',
        })

        // Act
        const result = await client.send(
          new SendMessageCommand({
            QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
            MessageBody: 'Message with attributes',
            MessageAttributes: {
              attr1: { DataType: 'String', StringValue: 'value1' },
            },
          }),
        )

        // Assert
        expect(result.MD5OfMessageAttributes).toBe('attrhash')
      })
    })

    describe('Error Cases', () => {
      it('should throw InvalidMessageContents for invalid characters', async () => {
        // Arrange
        const error = new Error('Invalid characters in message')
        error.name = 'InvalidMessageContents'
        sqsMock.on(SendMessageCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new SendMessageCommand({
              QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
              MessageBody: '\x00invalid', // null byte
            }),
          ),
        ).rejects.toThrow('Invalid characters in message')
      })

      it('should throw QueueDoesNotExist when queue not found', async () => {
        // Arrange
        const error = new Error('The specified queue does not exist')
        error.name = 'QueueDoesNotExist'
        sqsMock.on(SendMessageCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new SendMessageCommand({
              QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/non-existent-queue',
              MessageBody: 'Test message',
            }),
          ),
        ).rejects.toThrow('The specified queue does not exist')
      })

      it('should throw UnsupportedOperation for FIFO without MessageGroupId', async () => {
        // Arrange
        const error = new Error('MessageGroupId is required for FIFO queue')
        error.name = 'UnsupportedOperation'
        sqsMock.on(SendMessageCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new SendMessageCommand({
              QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue.fifo',
              MessageBody: 'FIFO without group ID',
            }),
          ),
        ).rejects.toThrow('MessageGroupId is required for FIFO queue')
      })
    })
  })

  // ============================================================================
  // ReceiveMessageCommand Tests
  // ============================================================================
  describe('ReceiveMessageCommand', () => {
    describe('Input Parameters - MaxNumberOfMessages, WaitTimeSeconds', () => {
      it('should send ReceiveMessageCommand with QueueUrl only', async () => {
        // Arrange
        sqsMock.on(ReceiveMessageCommand).resolves({
          Messages: [],
        })

        const params = {
          QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
        }

        // Act
        await client.send(new ReceiveMessageCommand(params))

        // Assert
        expect(sqsMock).toHaveReceivedCommandWith(ReceiveMessageCommand, {
          QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
        })
      })

      it('should send ReceiveMessageCommand with MaxNumberOfMessages', async () => {
        // Arrange
        sqsMock.on(ReceiveMessageCommand).resolves({
          Messages: [],
        })

        const params = {
          QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
          MaxNumberOfMessages: 10, // Max allowed
        }

        // Act
        await client.send(new ReceiveMessageCommand(params))

        // Assert
        expect(sqsMock).toHaveReceivedCommandWith(ReceiveMessageCommand, {
          MaxNumberOfMessages: 10,
        })
      })

      it('should send ReceiveMessageCommand with WaitTimeSeconds (long polling)', async () => {
        // Arrange
        sqsMock.on(ReceiveMessageCommand).resolves({
          Messages: [],
        })

        const params = {
          QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
          WaitTimeSeconds: 20, // Max allowed
        }

        // Act
        await client.send(new ReceiveMessageCommand(params))

        // Assert
        expect(sqsMock).toHaveReceivedCommandWith(ReceiveMessageCommand, {
          WaitTimeSeconds: 20,
        })
      })

      it('should send ReceiveMessageCommand with VisibilityTimeout', async () => {
        // Arrange
        sqsMock.on(ReceiveMessageCommand).resolves({
          Messages: [],
        })

        const params = {
          QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
          VisibilityTimeout: 300, // 5 minutes
        }

        // Act
        await client.send(new ReceiveMessageCommand(params))

        // Assert
        expect(sqsMock).toHaveReceivedCommandWith(ReceiveMessageCommand, {
          VisibilityTimeout: 300,
        })
      })

      it('should send ReceiveMessageCommand with MessageAttributeNames', async () => {
        // Arrange
        sqsMock.on(ReceiveMessageCommand).resolves({
          Messages: [],
        })

        const params = {
          QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
          MessageAttributeNames: ['All'], // or specific attribute names
        }

        // Act
        await client.send(new ReceiveMessageCommand(params))

        // Assert
        expect(sqsMock).toHaveReceivedCommandWith(ReceiveMessageCommand, {
          MessageAttributeNames: ['All'],
        })
      })

      it('should send ReceiveMessageCommand with AttributeNames (system attributes)', async () => {
        // Arrange
        sqsMock.on(ReceiveMessageCommand).resolves({
          Messages: [],
        })

        const params = {
          QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
          AttributeNames: [QueueAttributeName.All], // System attributes like SentTimestamp, ApproximateReceiveCount
        }

        // Act
        await client.send(new ReceiveMessageCommand(params))

        // Assert
        expect(sqsMock).toHaveReceivedCommandWith(ReceiveMessageCommand, {
          AttributeNames: [QueueAttributeName.All],
        })
      })

      it('should send ReceiveMessageCommand with ReceiveRequestAttemptId for FIFO', async () => {
        // Arrange
        sqsMock.on(ReceiveMessageCommand).resolves({
          Messages: [],
        })

        const params = {
          QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue.fifo',
          ReceiveRequestAttemptId: 'attempt-123',
        }

        // Act
        await client.send(new ReceiveMessageCommand(params))

        // Assert
        expect(sqsMock).toHaveReceivedCommandWith(ReceiveMessageCommand, {
          ReceiveRequestAttemptId: 'attempt-123',
        })
      })
    })

    describe('Return Values - Messages', () => {
      it('should return Messages array with message data', async () => {
        // Arrange
        const messages = [
          {
            MessageId: 'msg-id-1',
            ReceiptHandle: 'receipt-handle-1',
            MD5OfBody: 'md5hash1',
            Body: JSON.stringify({ action: 'CREATE', id: 1 }),
          },
          {
            MessageId: 'msg-id-2',
            ReceiptHandle: 'receipt-handle-2',
            MD5OfBody: 'md5hash2',
            Body: JSON.stringify({ action: 'UPDATE', id: 2 }),
          },
        ]
        sqsMock.on(ReceiveMessageCommand).resolves({
          Messages: messages,
        })

        // Act
        const result = await client.send(
          new ReceiveMessageCommand({
            QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
            MaxNumberOfMessages: 10,
          }),
        )

        // Assert
        expect(result.Messages).toHaveLength(2)
        expect(result.Messages![0].MessageId).toBe('msg-id-1')
        expect(result.Messages![0].ReceiptHandle).toBe('receipt-handle-1')
        expect(result.Messages![0].Body).toBe(JSON.stringify({ action: 'CREATE', id: 1 }))
        expect(result.Messages![1].MessageId).toBe('msg-id-2')
      })

      it('should return empty Messages array when queue is empty', async () => {
        // Arrange
        sqsMock.on(ReceiveMessageCommand).resolves({
          Messages: undefined,
        })

        // Act
        const result = await client.send(
          new ReceiveMessageCommand({
            QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
          }),
        )

        // Assert
        expect(result.Messages).toBeUndefined()
      })

      it('should return Messages with MessageAttributes', async () => {
        // Arrange
        sqsMock.on(ReceiveMessageCommand).resolves({
          Messages: [
            {
              MessageId: 'msg-id-attr',
              ReceiptHandle: 'receipt-handle-attr',
              Body: 'Message with attributes',
              MessageAttributes: {
                action: {
                  DataType: 'String',
                  StringValue: 'CREATE',
                },
                priority: {
                  DataType: 'Number',
                  StringValue: '1',
                },
              },
            },
          ],
        })

        // Act
        const result = await client.send(
          new ReceiveMessageCommand({
            QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
            MessageAttributeNames: ['All'],
          }),
        )

        // Assert
        expect(result.Messages![0].MessageAttributes).toBeDefined()
        expect(result.Messages![0].MessageAttributes!.action.StringValue).toBe('CREATE')
        expect(result.Messages![0].MessageAttributes!.priority.StringValue).toBe('1')
      })

      it('should return Messages with system Attributes', async () => {
        // Arrange
        sqsMock.on(ReceiveMessageCommand).resolves({
          Messages: [
            {
              MessageId: 'msg-id-sys',
              ReceiptHandle: 'receipt-handle-sys',
              Body: 'Message with system attributes',
              Attributes: {
                SentTimestamp: '1609459200000',
                ApproximateReceiveCount: '1',
                ApproximateFirstReceiveTimestamp: '1609459200500',
                SenderId: 'AIDAIT2UOQQY3AUEKVGXU',
              },
            },
          ],
        })

        // Act
        const result = await client.send(
          new ReceiveMessageCommand({
            QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
            AttributeNames: ['All'],
          }),
        )

        // Assert
        expect(result.Messages![0].Attributes).toBeDefined()
        expect(result.Messages![0].Attributes!.SentTimestamp).toBe('1609459200000')
        expect(result.Messages![0].Attributes!.ApproximateReceiveCount).toBe('1')
      })

      it('should return Messages with SequenceNumber for FIFO', async () => {
        // Arrange
        sqsMock.on(ReceiveMessageCommand).resolves({
          Messages: [
            {
              MessageId: 'fifo-msg-id',
              ReceiptHandle: 'fifo-receipt-handle',
              Body: 'FIFO message',
              Attributes: {
                MessageGroupId: 'group-1',
                MessageDeduplicationId: 'dedup-1',
                SequenceNumber: '10000000000000000001',
              },
            },
          ],
        })

        // Act
        const result = await client.send(
          new ReceiveMessageCommand({
            QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue.fifo',
            AttributeNames: ['All'],
          }),
        )

        // Assert
        expect(result.Messages![0].Attributes!.SequenceNumber).toBe('10000000000000000001')
        expect(result.Messages![0].Attributes!.MessageGroupId).toBe('group-1')
      })
    })

    describe('Error Cases', () => {
      it('should throw QueueDoesNotExist when queue not found', async () => {
        // Arrange
        const error = new Error('The specified queue does not exist')
        error.name = 'QueueDoesNotExist'
        sqsMock.on(ReceiveMessageCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new ReceiveMessageCommand({
              QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/non-existent-queue',
            }),
          ),
        ).rejects.toThrow('The specified queue does not exist')
      })

      it('should throw OverLimit when MaxNumberOfMessages > 10', async () => {
        // Arrange
        const error = new Error('Value for parameter MaxNumberOfMessages is invalid')
        error.name = 'OverLimit'
        sqsMock.on(ReceiveMessageCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new ReceiveMessageCommand({
              QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
              MaxNumberOfMessages: 11,
            }),
          ),
        ).rejects.toThrow('Value for parameter MaxNumberOfMessages is invalid')
      })
    })
  })

  // ============================================================================
  // DeleteMessageCommand Tests
  // ============================================================================
  describe('DeleteMessageCommand', () => {
    describe('Input Parameters - ReceiptHandle', () => {
      it('should send DeleteMessageCommand with QueueUrl and ReceiptHandle', async () => {
        // Arrange
        sqsMock.on(DeleteMessageCommand).resolves({})

        const params = {
          QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
          ReceiptHandle: 'AQEBwJnKyrHigUMZj6rYigCgxlaS3SLy0a...receipt-handle-token',
        }

        // Act
        await client.send(new DeleteMessageCommand(params))

        // Assert
        expect(sqsMock).toHaveReceivedCommandWith(DeleteMessageCommand, {
          QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
          ReceiptHandle: 'AQEBwJnKyrHigUMZj6rYigCgxlaS3SLy0a...receipt-handle-token',
        })
      })
    })

    describe('Return Values - Success', () => {
      it('should return success with httpStatusCode 200', async () => {
        // Arrange
        sqsMock.on(DeleteMessageCommand).resolves({
          $metadata: { httpStatusCode: 200 },
        })

        // Act
        const result = await client.send(
          new DeleteMessageCommand({
            QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
            ReceiptHandle: 'valid-receipt-handle',
          }),
        )

        // Assert
        expect(result.$metadata?.httpStatusCode).toBe(200)
      })

      it('should complete successfully even for already deleted message', async () => {
        // Note: SQS delete is idempotent - deleting already deleted message succeeds
        sqsMock.on(DeleteMessageCommand).resolves({
          $metadata: { httpStatusCode: 200 },
        })

        // Act
        const result = await client.send(
          new DeleteMessageCommand({
            QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
            ReceiptHandle: 'already-deleted-receipt-handle',
          }),
        )

        // Assert
        expect(result.$metadata?.httpStatusCode).toBe(200)
      })
    })

    describe('Error Cases', () => {
      it('should throw ReceiptHandleIsInvalid for invalid receipt handle', async () => {
        // Arrange
        const error = new Error('The input receipt handle is invalid')
        error.name = 'ReceiptHandleIsInvalid'
        sqsMock.on(DeleteMessageCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new DeleteMessageCommand({
              QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
              ReceiptHandle: 'invalid-receipt-handle',
            }),
          ),
        ).rejects.toThrow('The input receipt handle is invalid')
      })

      it('should throw QueueDoesNotExist when queue not found', async () => {
        // Arrange
        const error = new Error('The specified queue does not exist')
        error.name = 'QueueDoesNotExist'
        sqsMock.on(DeleteMessageCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new DeleteMessageCommand({
              QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/non-existent-queue',
              ReceiptHandle: 'some-receipt-handle',
            }),
          ),
        ).rejects.toThrow('The specified queue does not exist')
      })
    })
  })

  // ============================================================================
  // SendMessageBatchCommand Tests
  // ============================================================================
  describe('SendMessageBatchCommand', () => {
    describe('Input Parameters - Multiple Messages', () => {
      it('should send SendMessageBatchCommand with multiple messages', async () => {
        // Arrange
        sqsMock.on(SendMessageBatchCommand).resolves({
          Successful: [
            { Id: 'msg-1', MessageId: 'message-id-1', MD5OfMessageBody: 'md5-1' },
            { Id: 'msg-2', MessageId: 'message-id-2', MD5OfMessageBody: 'md5-2' },
            { Id: 'msg-3', MessageId: 'message-id-3', MD5OfMessageBody: 'md5-3' },
          ],
          Failed: [],
        })

        const params = {
          QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
          Entries: [
            { Id: 'msg-1', MessageBody: JSON.stringify({ id: 1, action: 'create' }) },
            { Id: 'msg-2', MessageBody: JSON.stringify({ id: 2, action: 'update' }) },
            { Id: 'msg-3', MessageBody: JSON.stringify({ id: 3, action: 'delete' }) },
          ],
        }

        // Act
        await client.send(new SendMessageBatchCommand(params))

        // Assert
        expect(sqsMock).toHaveReceivedCommandWith(SendMessageBatchCommand, {
          QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
          Entries: expect.arrayContaining([
            expect.objectContaining({ Id: 'msg-1' }),
            expect.objectContaining({ Id: 'msg-2' }),
            expect.objectContaining({ Id: 'msg-3' }),
          ]),
        })
      })

      it('should send SendMessageBatchCommand with DelaySeconds per message', async () => {
        // Arrange
        sqsMock.on(SendMessageBatchCommand).resolves({
          Successful: [
            { Id: 'immediate', MessageId: 'msg-id-1', MD5OfMessageBody: 'md5-1' },
            { Id: 'delayed', MessageId: 'msg-id-2', MD5OfMessageBody: 'md5-2' },
          ],
          Failed: [],
        })

        const params = {
          QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
          Entries: [
            { Id: 'immediate', MessageBody: 'Immediate message', DelaySeconds: 0 },
            { Id: 'delayed', MessageBody: 'Delayed message', DelaySeconds: 300 },
          ],
        }

        // Act
        await client.send(new SendMessageBatchCommand(params))

        // Assert
        expect(sqsMock).toHaveReceivedCommandWith(SendMessageBatchCommand, {
          Entries: expect.arrayContaining([
            expect.objectContaining({ Id: 'immediate', DelaySeconds: 0 }),
            expect.objectContaining({ Id: 'delayed', DelaySeconds: 300 }),
          ]),
        })
      })

      it('should send SendMessageBatchCommand with MessageAttributes per message', async () => {
        // Arrange
        sqsMock.on(SendMessageBatchCommand).resolves({
          Successful: [{ Id: 'attr-msg', MessageId: 'attr-msg-id', MD5OfMessageBody: 'md5' }],
          Failed: [],
        })

        const params = {
          QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
          Entries: [
            {
              Id: 'attr-msg',
              MessageBody: 'Message with attributes',
              MessageAttributes: {
                action: {
                  DataType: 'String',
                  StringValue: 'CREATE',
                },
              },
            },
          ],
        }

        // Act
        await client.send(new SendMessageBatchCommand(params))

        // Assert
        expect(sqsMock).toHaveReceivedCommandWith(SendMessageBatchCommand, {
          Entries: expect.arrayContaining([
            expect.objectContaining({
              MessageAttributes: expect.objectContaining({
                action: expect.objectContaining({
                  DataType: 'String',
                  StringValue: 'CREATE',
                }),
              }),
            }),
          ]),
        })
      })

      it('should send SendMessageBatchCommand to FIFO queue with MessageGroupId', async () => {
        // Arrange
        sqsMock.on(SendMessageBatchCommand).resolves({
          Successful: [
            { Id: 'fifo-1', MessageId: 'fifo-msg-1', SequenceNumber: '1', MD5OfMessageBody: 'md5' },
            { Id: 'fifo-2', MessageId: 'fifo-msg-2', SequenceNumber: '2', MD5OfMessageBody: 'md5' },
          ],
          Failed: [],
        })

        const params = {
          QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue.fifo',
          Entries: [
            {
              Id: 'fifo-1',
              MessageBody: 'FIFO message 1',
              MessageGroupId: 'group-1',
              MessageDeduplicationId: 'dedup-1',
            },
            {
              Id: 'fifo-2',
              MessageBody: 'FIFO message 2',
              MessageGroupId: 'group-1',
              MessageDeduplicationId: 'dedup-2',
            },
          ],
        }

        // Act
        await client.send(new SendMessageBatchCommand(params))

        // Assert
        expect(sqsMock).toHaveReceivedCommandWith(SendMessageBatchCommand, {
          Entries: expect.arrayContaining([
            expect.objectContaining({
              MessageGroupId: 'group-1',
              MessageDeduplicationId: 'dedup-1',
            }),
          ]),
        })
      })
    })

    describe('Return Values - Successful and Failed', () => {
      it('should return Successful array with MessageIds', async () => {
        // Arrange
        sqsMock.on(SendMessageBatchCommand).resolves({
          Successful: [
            { Id: 'msg-1', MessageId: 'message-id-1', MD5OfMessageBody: 'md5-1' },
            { Id: 'msg-2', MessageId: 'message-id-2', MD5OfMessageBody: 'md5-2' },
          ],
          Failed: [],
        })

        // Act
        const result = await client.send(
          new SendMessageBatchCommand({
            QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
            Entries: [
              { Id: 'msg-1', MessageBody: 'Message 1' },
              { Id: 'msg-2', MessageBody: 'Message 2' },
            ],
          }),
        )

        // Assert
        expect(result.Successful).toHaveLength(2)
        expect(result.Successful![0].Id).toBe('msg-1')
        expect(result.Successful![0].MessageId).toBe('message-id-1')
        expect(result.Successful![1].Id).toBe('msg-2')
        expect(result.Successful![1].MessageId).toBe('message-id-2')
        expect(result.Failed).toEqual([])
      })

      it('should return Failed array with error details', async () => {
        // Arrange
        sqsMock.on(SendMessageBatchCommand).resolves({
          Successful: [{ Id: 'msg-1', MessageId: 'message-id-1', MD5OfMessageBody: 'md5' }],
          Failed: [
            {
              Id: 'msg-2',
              Code: 'InvalidMessageContents',
              Message: 'Message contains invalid characters',
              SenderFault: true,
            },
          ],
        })

        // Act
        const result = await client.send(
          new SendMessageBatchCommand({
            QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
            Entries: [
              { Id: 'msg-1', MessageBody: 'Valid message' },
              { Id: 'msg-2', MessageBody: '\x00invalid' },
            ],
          }),
        )

        // Assert
        expect(result.Successful).toHaveLength(1)
        expect(result.Failed).toHaveLength(1)
        expect(result.Failed![0].Id).toBe('msg-2')
        expect(result.Failed![0].Code).toBe('InvalidMessageContents')
        expect(result.Failed![0].SenderFault).toBe(true)
      })

      it('should return SequenceNumber for FIFO queues', async () => {
        // Arrange
        sqsMock.on(SendMessageBatchCommand).resolves({
          Successful: [
            { Id: 'fifo-1', MessageId: 'fifo-id-1', SequenceNumber: '10000000000000000001', MD5OfMessageBody: 'md5' },
            { Id: 'fifo-2', MessageId: 'fifo-id-2', SequenceNumber: '10000000000000000002', MD5OfMessageBody: 'md5' },
          ],
          Failed: [],
        })

        // Act
        const result = await client.send(
          new SendMessageBatchCommand({
            QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue.fifo',
            Entries: [
              { Id: 'fifo-1', MessageBody: 'FIFO 1', MessageGroupId: 'g1' },
              { Id: 'fifo-2', MessageBody: 'FIFO 2', MessageGroupId: 'g1' },
            ],
          }),
        )

        // Assert
        expect(result.Successful![0].SequenceNumber).toBe('10000000000000000001')
        expect(result.Successful![1].SequenceNumber).toBe('10000000000000000002')
      })

      it('should return MD5OfMessageAttributes when provided', async () => {
        // Arrange
        sqsMock.on(SendMessageBatchCommand).resolves({
          Successful: [
            {
              Id: 'attr-msg',
              MessageId: 'attr-msg-id',
              MD5OfMessageBody: 'bodyhash',
              MD5OfMessageAttributes: 'attrhash',
            },
          ],
          Failed: [],
        })

        // Act
        const result = await client.send(
          new SendMessageBatchCommand({
            QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
            Entries: [
              {
                Id: 'attr-msg',
                MessageBody: 'Message with attrs',
                MessageAttributes: {
                  attr1: { DataType: 'String', StringValue: 'value1' },
                },
              },
            ],
          }),
        )

        // Assert
        expect(result.Successful![0].MD5OfMessageAttributes).toBe('attrhash')
      })
    })

    describe('Error Cases', () => {
      it('should throw BatchEntryIdsNotDistinct for duplicate IDs', async () => {
        // Arrange
        const error = new Error('Two or more batch entries have the same Id')
        error.name = 'BatchEntryIdsNotDistinct'
        sqsMock.on(SendMessageBatchCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new SendMessageBatchCommand({
              QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
              Entries: [
                { Id: 'duplicate-id', MessageBody: 'Message 1' },
                { Id: 'duplicate-id', MessageBody: 'Message 2' },
              ],
            }),
          ),
        ).rejects.toThrow('Two or more batch entries have the same Id')
      })

      it('should throw TooManyEntriesInBatchRequest for >10 messages', async () => {
        // Arrange
        const error = new Error('Maximum number of entries per request are 10')
        error.name = 'TooManyEntriesInBatchRequest'
        sqsMock.on(SendMessageBatchCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new SendMessageBatchCommand({
              QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
              Entries: Array.from({ length: 11 }, (_, i) => ({
                Id: `msg-${i}`,
                MessageBody: `Message ${i}`,
              })),
            }),
          ),
        ).rejects.toThrow('Maximum number of entries per request are 10')
      })

      it('should throw EmptyBatchRequest for empty entries', async () => {
        // Arrange
        const error = new Error('The batch request does not contain any entries')
        error.name = 'EmptyBatchRequest'
        sqsMock.on(SendMessageBatchCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new SendMessageBatchCommand({
              QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
              Entries: [],
            }),
          ),
        ).rejects.toThrow('The batch request does not contain any entries')
      })

      it('should throw BatchRequestTooLong when total size exceeds limit', async () => {
        // Arrange
        const error = new Error('Batch requests cannot be longer than 262144 bytes')
        error.name = 'BatchRequestTooLong'
        sqsMock.on(SendMessageBatchCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new SendMessageBatchCommand({
              QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
              Entries: [
                { Id: 'large-msg', MessageBody: 'x'.repeat(262144) },
              ],
            }),
          ),
        ).rejects.toThrow('Batch requests cannot be longer than 262144 bytes')
      })
    })
  })

  // ============================================================================
  // Additional Test Cases for Edge Scenarios
  // ============================================================================
  describe('Edge Cases', () => {
    it('should handle concurrent send operations', async () => {
      // Arrange
      sqsMock.on(SendMessageCommand).resolves({
        MessageId: 'concurrent-msg-id',
      })

      // Act
      const promises = Array.from({ length: 10 }, (_, i) =>
        client.send(
          new SendMessageCommand({
            QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
            MessageBody: `Concurrent message ${i}`,
          }),
        ),
      )

      const results = await Promise.all(promises)

      // Assert
      expect(results).toHaveLength(10)
      results.forEach((result) => {
        expect(result.MessageId).toBe('concurrent-msg-id')
      })
      expect(sqsMock).toHaveReceivedCommandTimes(SendMessageCommand, 10)
    })

    it('should handle message with maximum size (256KB)', async () => {
      // Arrange
      sqsMock.on(SendMessageCommand).resolves({
        MessageId: 'large-msg-id',
      })

      // Create a message close to 256KB limit
      const largeMessage = 'x'.repeat(250000)

      // Act
      const result = await client.send(
        new SendMessageCommand({
          QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
          MessageBody: largeMessage,
        }),
      )

      // Assert
      expect(result.MessageId).toBe('large-msg-id')
    })

    it('should handle message with special characters', async () => {
      // Arrange
      sqsMock.on(SendMessageCommand).resolves({
        MessageId: 'special-msg-id',
      })

      const specialMessage = JSON.stringify({
        unicode: 'Japanese test message',
        special: '!@#$%^&*()_+-={}[]|\\:";\'<>?,./~`',
        newlines: 'Line 1\nLine 2\rLine 3\r\n',
      })

      // Act
      const result = await client.send(
        new SendMessageCommand({
          QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
          MessageBody: specialMessage,
        }),
      )

      // Assert
      expect(result.MessageId).toBe('special-msg-id')
      expect(sqsMock).toHaveReceivedCommandWith(SendMessageCommand, {
        MessageBody: specialMessage,
      })
    })

    it('should handle receive with varying message counts', async () => {
      // Chain resolvesOnce calls for sequential responses
      sqsMock.on(ReceiveMessageCommand)
        // First call returns 3 messages
        .resolvesOnce({
          Messages: [
            { MessageId: 'msg-1', ReceiptHandle: 'rh-1', Body: 'Message 1' },
            { MessageId: 'msg-2', ReceiptHandle: 'rh-2', Body: 'Message 2' },
            { MessageId: 'msg-3', ReceiptHandle: 'rh-3', Body: 'Message 3' },
          ],
        })
        // Second call returns 1 message
        .resolvesOnce({
          Messages: [{ MessageId: 'msg-4', ReceiptHandle: 'rh-4', Body: 'Message 4' }],
        })
        // Third call returns no messages
        .resolves({
          Messages: undefined,
        })

      // Act
      const result1 = await client.send(
        new ReceiveMessageCommand({
          QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
          MaxNumberOfMessages: 10,
        }),
      )
      const result2 = await client.send(
        new ReceiveMessageCommand({
          QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
          MaxNumberOfMessages: 10,
        }),
      )
      const result3 = await client.send(
        new ReceiveMessageCommand({
          QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test-queue',
          MaxNumberOfMessages: 10,
        }),
      )

      // Assert
      expect(result1.Messages).toHaveLength(3)
      expect(result2.Messages).toHaveLength(1)
      expect(result3.Messages).toBeUndefined()
    })
  })
})
