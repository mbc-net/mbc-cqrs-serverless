/**
 * AWS SNS Client Integration Tests
 *
 * This file tests the AWS SDK SNS client commands using aws-sdk-client-mock.
 * It covers input parameters (IN) and return values (OUT) for each command.
 */
import {
  PublishBatchCommand,
  PublishCommand,
  SNSClient,
} from '@aws-sdk/client-sns'
import { mockClient } from 'aws-sdk-client-mock'
import 'aws-sdk-client-mock-jest'

describe('AWS SNS Client Commands', () => {
  const snsMock = mockClient(SNSClient)
  const client = new SNSClient({ region: 'ap-northeast-1' })

  beforeEach(() => {
    snsMock.reset()
  })

  afterEach(() => {
    snsMock.reset()
  })

  // ============================================================================
  // PublishCommand Tests
  // ============================================================================
  describe('PublishCommand', () => {
    describe('Input Parameters - TopicArn, Message, MessageAttributes', () => {
      it('should send PublishCommand with TopicArn and Message', async () => {
        // Arrange
        snsMock.on(PublishCommand).resolves({
          MessageId: 'test-message-id-123',
        })

        const params = {
          TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic',
          Message: JSON.stringify({ action: 'TEST', data: 'value' }),
        }

        // Act
        await client.send(new PublishCommand(params))

        // Assert
        expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
          TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic',
          Message: JSON.stringify({ action: 'TEST', data: 'value' }),
        })
      })

      it('should send PublishCommand with TargetArn (for direct endpoint)', async () => {
        // Arrange
        snsMock.on(PublishCommand).resolves({
          MessageId: 'test-message-id-456',
        })

        const params = {
          TargetArn: 'arn:aws:sns:ap-northeast-1:123456789012:endpoint/APNS/test-app/device-token',
          Message: 'Direct push notification message',
        }

        // Act
        await client.send(new PublishCommand(params))

        // Assert
        expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
          TargetArn: expect.stringContaining('endpoint/APNS'),
        })
      })

      it('should send PublishCommand with MessageAttributes', async () => {
        // Arrange
        snsMock.on(PublishCommand).resolves({
          MessageId: 'test-message-id-789',
        })

        const params = {
          TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic',
          Message: JSON.stringify({ action: 'CREATE', entity: 'user' }),
          MessageAttributes: {
            action: {
              DataType: 'String',
              StringValue: 'CREATE',
            },
            entityType: {
              DataType: 'String',
              StringValue: 'user',
            },
            priority: {
              DataType: 'Number',
              StringValue: '1',
            },
          },
        }

        // Act
        await client.send(new PublishCommand(params))

        // Assert
        expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
          MessageAttributes: {
            action: {
              DataType: 'String',
              StringValue: 'CREATE',
            },
            entityType: {
              DataType: 'String',
              StringValue: 'user',
            },
            priority: {
              DataType: 'Number',
              StringValue: '1',
            },
          },
        })
      })

      it('should send PublishCommand with MessageStructure for platform-specific messages', async () => {
        // Arrange
        snsMock.on(PublishCommand).resolves({
          MessageId: 'test-message-id-multi',
        })

        const platformMessage = {
          default: 'Default message',
          APNS: JSON.stringify({ aps: { alert: 'iOS message' } }),
          GCM: JSON.stringify({ notification: { body: 'Android message' } }),
        }

        const params = {
          TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:mobile-topic',
          Message: JSON.stringify(platformMessage),
          MessageStructure: 'json',
        }

        // Act
        await client.send(new PublishCommand(params))

        // Assert
        expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
          MessageStructure: 'json',
        })
      })

      it('should send PublishCommand with Subject for email topics', async () => {
        // Arrange
        snsMock.on(PublishCommand).resolves({
          MessageId: 'test-message-id-email',
        })

        const params = {
          TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:email-topic',
          Subject: 'Important Notification',
          Message: 'This is the email body content.',
        }

        // Act
        await client.send(new PublishCommand(params))

        // Assert
        expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
          Subject: 'Important Notification',
        })
      })

      it('should send PublishCommand with MessageDeduplicationId for FIFO topics', async () => {
        // Arrange
        snsMock.on(PublishCommand).resolves({
          MessageId: 'test-message-id-fifo',
          SequenceNumber: '10000000000000000000',
        })

        const params = {
          TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic.fifo',
          Message: 'FIFO message',
          MessageGroupId: 'group-1',
          MessageDeduplicationId: 'dedup-123',
        }

        // Act
        await client.send(new PublishCommand(params))

        // Assert
        expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
          MessageGroupId: 'group-1',
          MessageDeduplicationId: 'dedup-123',
        })
      })
    })

    describe('Return Values - MessageId', () => {
      it('should return MessageId on successful publish', async () => {
        // Arrange
        const expectedMessageId = 'abc123-def456-ghi789'
        snsMock.on(PublishCommand).resolves({
          MessageId: expectedMessageId,
        })

        // Act
        const result = await client.send(
          new PublishCommand({
            TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic',
            Message: 'Test message',
          }),
        )

        // Assert
        expect(result.MessageId).toBe(expectedMessageId)
      })

      it('should return SequenceNumber for FIFO topics', async () => {
        // Arrange
        snsMock.on(PublishCommand).resolves({
          MessageId: 'fifo-message-id',
          SequenceNumber: '10000000000000000001',
        })

        // Act
        const result = await client.send(
          new PublishCommand({
            TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic.fifo',
            Message: 'FIFO message',
            MessageGroupId: 'group-1',
          }),
        )

        // Assert
        expect(result.MessageId).toBe('fifo-message-id')
        expect(result.SequenceNumber).toBe('10000000000000000001')
      })

      it('should return $metadata with httpStatusCode', async () => {
        // Arrange
        snsMock.on(PublishCommand).resolves({
          MessageId: 'test-id',
          $metadata: { httpStatusCode: 200 },
        })

        // Act
        const result = await client.send(
          new PublishCommand({
            TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic',
            Message: 'Test message',
          }),
        )

        // Assert
        expect(result.$metadata?.httpStatusCode).toBe(200)
      })
    })

    describe('Error Cases', () => {
      it('should throw InvalidParameterException for invalid TopicArn', async () => {
        // Arrange
        const error = new Error('Invalid parameter: TopicArn')
        error.name = 'InvalidParameterException'
        snsMock.on(PublishCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new PublishCommand({
              TopicArn: 'invalid-topic-arn',
              Message: 'Test message',
            }),
          ),
        ).rejects.toThrow('Invalid parameter: TopicArn')
      })

      it('should throw NotFoundException when TopicArn does not exist', async () => {
        // Arrange
        const error = new Error('Topic does not exist')
        error.name = 'NotFoundException'
        snsMock.on(PublishCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new PublishCommand({
              TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:non-existent-topic',
              Message: 'Test message',
            }),
          ),
        ).rejects.toThrow('Topic does not exist')
      })

      it('should throw AuthorizationErrorException when not authorized', async () => {
        // Arrange
        const error = new Error('User is not authorized to perform: SNS:Publish')
        error.name = 'AuthorizationErrorException'
        snsMock.on(PublishCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new PublishCommand({
              TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:restricted-topic',
              Message: 'Test message',
            }),
          ),
        ).rejects.toThrow('User is not authorized')
      })

      it('should throw InvalidParameterValueException for invalid MessageAttributes', async () => {
        // Arrange
        const error = new Error('Invalid parameter: MessageAttributes')
        error.name = 'InvalidParameterValueException'
        snsMock.on(PublishCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new PublishCommand({
              TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic',
              Message: 'Test message',
              MessageAttributes: {
                invalidAttr: {
                  DataType: 'InvalidType',
                  StringValue: 'value',
                },
              },
            }),
          ),
        ).rejects.toThrow('Invalid parameter: MessageAttributes')
      })

      it('should throw KMSAccessDeniedException when KMS key access denied', async () => {
        // Arrange
        const error = new Error('KMS access denied')
        error.name = 'KMSAccessDeniedException'
        snsMock.on(PublishCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new PublishCommand({
              TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:encrypted-topic',
              Message: 'Test message',
            }),
          ),
        ).rejects.toThrow('KMS access denied')
      })

      it('should throw EndpointDisabledException when endpoint is disabled', async () => {
        // Arrange
        const error = new Error('Endpoint is disabled')
        error.name = 'EndpointDisabledException'
        snsMock.on(PublishCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new PublishCommand({
              TargetArn: 'arn:aws:sns:ap-northeast-1:123456789012:endpoint/disabled',
              Message: 'Test message',
            }),
          ),
        ).rejects.toThrow('Endpoint is disabled')
      })
    })
  })

  // ============================================================================
  // PublishBatchCommand Tests
  // ============================================================================
  describe('PublishBatchCommand', () => {
    describe('Input Parameters - Multiple Messages', () => {
      it('should send PublishBatchCommand with multiple messages', async () => {
        // Arrange
        snsMock.on(PublishBatchCommand).resolves({
          Successful: [
            { Id: 'msg-1', MessageId: 'message-id-1' },
            { Id: 'msg-2', MessageId: 'message-id-2' },
            { Id: 'msg-3', MessageId: 'message-id-3' },
          ],
          Failed: [],
        })

        const params = {
          TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic',
          PublishBatchRequestEntries: [
            { Id: 'msg-1', Message: JSON.stringify({ id: 1, action: 'create' }) },
            { Id: 'msg-2', Message: JSON.stringify({ id: 2, action: 'update' }) },
            { Id: 'msg-3', Message: JSON.stringify({ id: 3, action: 'delete' }) },
          ],
        }

        // Act
        await client.send(new PublishBatchCommand(params))

        // Assert
        expect(snsMock).toHaveReceivedCommandWith(PublishBatchCommand, {
          TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic',
          PublishBatchRequestEntries: expect.arrayContaining([
            expect.objectContaining({ Id: 'msg-1' }),
            expect.objectContaining({ Id: 'msg-2' }),
            expect.objectContaining({ Id: 'msg-3' }),
          ]),
        })
      })

      it('should send PublishBatchCommand with MessageAttributes for each message', async () => {
        // Arrange
        snsMock.on(PublishBatchCommand).resolves({
          Successful: [{ Id: 'msg-1', MessageId: 'message-id-1' }],
          Failed: [],
        })

        const params = {
          TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic',
          PublishBatchRequestEntries: [
            {
              Id: 'msg-1',
              Message: JSON.stringify({ action: 'CREATE' }),
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
        }

        // Act
        await client.send(new PublishBatchCommand(params))

        // Assert
        expect(snsMock).toHaveReceivedCommandWith(PublishBatchCommand, {
          PublishBatchRequestEntries: expect.arrayContaining([
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

      it('should send PublishBatchCommand with Subject for each message', async () => {
        // Arrange
        snsMock.on(PublishBatchCommand).resolves({
          Successful: [
            { Id: 'email-1', MessageId: 'email-message-id-1' },
            { Id: 'email-2', MessageId: 'email-message-id-2' },
          ],
          Failed: [],
        })

        const params = {
          TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:email-topic',
          PublishBatchRequestEntries: [
            {
              Id: 'email-1',
              Subject: 'First Email Subject',
              Message: 'First email body',
            },
            {
              Id: 'email-2',
              Subject: 'Second Email Subject',
              Message: 'Second email body',
            },
          ],
        }

        // Act
        await client.send(new PublishBatchCommand(params))

        // Assert
        expect(snsMock).toHaveReceivedCommandWith(PublishBatchCommand, {
          PublishBatchRequestEntries: expect.arrayContaining([
            expect.objectContaining({ Subject: 'First Email Subject' }),
            expect.objectContaining({ Subject: 'Second Email Subject' }),
          ]),
        })
      })

      it('should send PublishBatchCommand to FIFO topic with MessageGroupId', async () => {
        // Arrange
        snsMock.on(PublishBatchCommand).resolves({
          Successful: [
            { Id: 'fifo-1', MessageId: 'fifo-message-id-1', SequenceNumber: '1' },
            { Id: 'fifo-2', MessageId: 'fifo-message-id-2', SequenceNumber: '2' },
          ],
          Failed: [],
        })

        const params = {
          TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic.fifo',
          PublishBatchRequestEntries: [
            {
              Id: 'fifo-1',
              Message: 'FIFO message 1',
              MessageGroupId: 'group-1',
              MessageDeduplicationId: 'dedup-1',
            },
            {
              Id: 'fifo-2',
              Message: 'FIFO message 2',
              MessageGroupId: 'group-1',
              MessageDeduplicationId: 'dedup-2',
            },
          ],
        }

        // Act
        await client.send(new PublishBatchCommand(params))

        // Assert
        expect(snsMock).toHaveReceivedCommandWith(PublishBatchCommand, {
          PublishBatchRequestEntries: expect.arrayContaining([
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
        snsMock.on(PublishBatchCommand).resolves({
          Successful: [
            { Id: 'msg-1', MessageId: 'message-id-1' },
            { Id: 'msg-2', MessageId: 'message-id-2' },
          ],
          Failed: [],
        })

        // Act
        const result = await client.send(
          new PublishBatchCommand({
            TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic',
            PublishBatchRequestEntries: [
              { Id: 'msg-1', Message: 'Message 1' },
              { Id: 'msg-2', Message: 'Message 2' },
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
        snsMock.on(PublishBatchCommand).resolves({
          Successful: [{ Id: 'msg-1', MessageId: 'message-id-1' }],
          Failed: [
            {
              Id: 'msg-2',
              Code: 'InvalidParameter',
              Message: 'Invalid message format',
              SenderFault: true,
            },
          ],
        })

        // Act
        const result = await client.send(
          new PublishBatchCommand({
            TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic',
            PublishBatchRequestEntries: [
              { Id: 'msg-1', Message: 'Valid message' },
              { Id: 'msg-2', Message: '' }, // Invalid empty message
            ],
          }),
        )

        // Assert
        expect(result.Successful).toHaveLength(1)
        expect(result.Failed).toHaveLength(1)
        expect(result.Failed![0].Id).toBe('msg-2')
        expect(result.Failed![0].Code).toBe('InvalidParameter')
        expect(result.Failed![0].SenderFault).toBe(true)
      })

      it('should return SequenceNumber for FIFO topics', async () => {
        // Arrange
        snsMock.on(PublishBatchCommand).resolves({
          Successful: [
            { Id: 'fifo-1', MessageId: 'fifo-id-1', SequenceNumber: '10000000000000000001' },
            { Id: 'fifo-2', MessageId: 'fifo-id-2', SequenceNumber: '10000000000000000002' },
          ],
          Failed: [],
        })

        // Act
        const result = await client.send(
          new PublishBatchCommand({
            TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic.fifo',
            PublishBatchRequestEntries: [
              { Id: 'fifo-1', Message: 'FIFO 1', MessageGroupId: 'g1' },
              { Id: 'fifo-2', Message: 'FIFO 2', MessageGroupId: 'g1' },
            ],
          }),
        )

        // Assert
        expect(result.Successful![0].SequenceNumber).toBe('10000000000000000001')
        expect(result.Successful![1].SequenceNumber).toBe('10000000000000000002')
      })

      it('should return partial success when some messages fail', async () => {
        // Arrange
        snsMock.on(PublishBatchCommand).resolves({
          Successful: [
            { Id: 'msg-1', MessageId: 'message-id-1' },
            { Id: 'msg-3', MessageId: 'message-id-3' },
          ],
          Failed: [
            {
              Id: 'msg-2',
              Code: 'InternalError',
              Message: 'Internal server error',
              SenderFault: false,
            },
          ],
        })

        // Act
        const result = await client.send(
          new PublishBatchCommand({
            TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic',
            PublishBatchRequestEntries: [
              { Id: 'msg-1', Message: 'Message 1' },
              { Id: 'msg-2', Message: 'Message 2' },
              { Id: 'msg-3', Message: 'Message 3' },
            ],
          }),
        )

        // Assert
        expect(result.Successful).toHaveLength(2)
        expect(result.Failed).toHaveLength(1)
        expect(result.Failed![0].SenderFault).toBe(false)
      })
    })

    describe('Error Cases', () => {
      it('should throw BatchEntryIdsNotDistinctException for duplicate IDs', async () => {
        // Arrange
        const error = new Error('Two or more batch entries have the same Id')
        error.name = 'BatchEntryIdsNotDistinctException'
        snsMock.on(PublishBatchCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new PublishBatchCommand({
              TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic',
              PublishBatchRequestEntries: [
                { Id: 'duplicate-id', Message: 'Message 1' },
                { Id: 'duplicate-id', Message: 'Message 2' },
              ],
            }),
          ),
        ).rejects.toThrow('Two or more batch entries have the same Id')
      })

      it('should throw TooManyEntriesInBatchRequestException for >10 messages', async () => {
        // Arrange
        const error = new Error('The batch request contains more entries than permissible')
        error.name = 'TooManyEntriesInBatchRequestException'
        snsMock.on(PublishBatchCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new PublishBatchCommand({
              TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic',
              PublishBatchRequestEntries: Array.from({ length: 11 }, (_, i) => ({
                Id: `msg-${i}`,
                Message: `Message ${i}`,
              })),
            }),
          ),
        ).rejects.toThrow('The batch request contains more entries than permissible')
      })

      it('should throw EmptyBatchRequestException for empty entries', async () => {
        // Arrange
        const error = new Error('The batch request does not contain any entries')
        error.name = 'EmptyBatchRequestException'
        snsMock.on(PublishBatchCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new PublishBatchCommand({
              TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic',
              PublishBatchRequestEntries: [],
            }),
          ),
        ).rejects.toThrow('The batch request does not contain any entries')
      })

      it('should throw InvalidBatchEntryIdException for invalid entry ID', async () => {
        // Arrange
        const error = new Error('The Id of a batch entry is invalid')
        error.name = 'InvalidBatchEntryIdException'
        snsMock.on(PublishBatchCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new PublishBatchCommand({
              TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic',
              PublishBatchRequestEntries: [
                { Id: '', Message: 'Message' }, // Empty ID is invalid
              ],
            }),
          ),
        ).rejects.toThrow('The Id of a batch entry is invalid')
      })

      it('should throw BatchRequestTooLongException when total size exceeds limit', async () => {
        // Arrange
        const error = new Error('The length of all the batch messages put together is more than the limit')
        error.name = 'BatchRequestTooLongException'
        snsMock.on(PublishBatchCommand).rejects(error)

        // Act & Assert
        await expect(
          client.send(
            new PublishBatchCommand({
              TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic',
              PublishBatchRequestEntries: [
                { Id: 'msg-1', Message: 'x'.repeat(262144) }, // Very large message
              ],
            }),
          ),
        ).rejects.toThrow('The length of all the batch messages put together is more than the limit')
      })
    })
  })

  // ============================================================================
  // Additional Test Cases for Edge Scenarios
  // ============================================================================
  describe('Edge Cases', () => {
    it('should handle publishing empty string message', async () => {
      // Note: SNS actually rejects empty messages, but this tests the mock behavior
      snsMock.on(PublishCommand).resolves({
        MessageId: 'empty-msg-id',
      })

      const result = await client.send(
        new PublishCommand({
          TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic',
          Message: '',
        }),
      )

      expect(result.MessageId).toBe('empty-msg-id')
    })

    it('should handle publishing message with special characters', async () => {
      snsMock.on(PublishCommand).resolves({
        MessageId: 'special-char-id',
      })

      const specialMessage = JSON.stringify({
        unicode: 'Japanese text - Test message',
        emoji: 'Test emoji message',
        special: '!@#$%^&*()_+-={}[]|\\:";\'<>?,./~`',
      })

      const result = await client.send(
        new PublishCommand({
          TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic',
          Message: specialMessage,
        }),
      )

      expect(result.MessageId).toBe('special-char-id')
      expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
        Message: specialMessage,
      })
    })

    it('should handle publishing large message (up to 256KB)', async () => {
      snsMock.on(PublishCommand).resolves({
        MessageId: 'large-msg-id',
      })

      // Create a message close to 256KB limit
      const largeMessage = 'x'.repeat(250000)

      const result = await client.send(
        new PublishCommand({
          TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic',
          Message: largeMessage,
        }),
      )

      expect(result.MessageId).toBe('large-msg-id')
    })

    it('should handle concurrent publish operations', async () => {
      snsMock.on(PublishCommand).resolves({
        MessageId: 'concurrent-msg-id',
      })

      const promises = Array.from({ length: 10 }, (_, i) =>
        client.send(
          new PublishCommand({
            TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic',
            Message: `Concurrent message ${i}`,
          }),
        ),
      )

      const results = await Promise.all(promises)

      expect(results).toHaveLength(10)
      results.forEach((result) => {
        expect(result.MessageId).toBe('concurrent-msg-id')
      })
      expect(snsMock).toHaveReceivedCommandTimes(PublishCommand, 10)
    })
  })
})
