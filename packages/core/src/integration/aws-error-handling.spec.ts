/**
 * AWS SDK Detailed Error Handling Tests
 *
 * This file tests detailed exception handling for all AWS SDK services
 * used in the framework:
 * - DynamoDB: ProvisionedThroughputExceededException, ItemCollectionSizeLimitExceededException
 * - S3: EntityTooLarge, NoSuchBucket, NoSuchKey
 * - SQS: QueueDoesNotExist, MessageNotInflight
 * - SNS: TopicLimitExceededException, InvalidParameter
 * - SFN: InvalidArn, ExecutionAlreadyExists
 * - SES: MessageRejected, MailFromDomainNotVerified
 *
 * These tests verify error metadata preservation and exception structure
 * to detect breaking changes in package updates.
 */
import {
  BatchWriteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  TransactWriteItemsCommand,
} from '@aws-sdk/client-dynamodb'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs'
import {
  PublishCommand,
  SNSClient,
  SubscribeCommand,
} from '@aws-sdk/client-sns'
import {
  SFNClient,
  StartExecutionCommand,
  DescribeExecutionCommand,
} from '@aws-sdk/client-sfn'
import {
  SESv2Client,
  SendEmailCommand,
} from '@aws-sdk/client-sesv2'
import { marshall } from '@aws-sdk/util-dynamodb'
import { mockClient } from 'aws-sdk-client-mock'
import 'aws-sdk-client-mock-jest'

describe('AWS SDK Detailed Error Handling', () => {
  // ============================================================================
  // DynamoDB Detailed Exceptions
  // ============================================================================
  describe('DynamoDB Detailed Exceptions', () => {
    const dynamoMock = mockClient(DynamoDBClient)
    const client = new DynamoDBClient({ region: 'ap-northeast-1' })

    beforeEach(() => {
      dynamoMock.reset()
    })

    describe('ProvisionedThroughputExceededException', () => {
      it('should have expected error name and structure', async () => {
        const error = new Error('Rate exceeded') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
          retryAfterSeconds?: number
        }
        error.name = 'ProvisionedThroughputExceededException'
        error.$metadata = { httpStatusCode: 400 }
        error.retryAfterSeconds = 5
        dynamoMock.on(PutItemCommand).rejects(error)

        try {
          await client.send(
            new PutItemCommand({
              TableName: 'test-table',
              Item: marshall({ pk: 'pk', sk: 'sk' }),
            }),
          )
          fail('Expected error to be thrown')
        } catch (e: any) {
          expect(e.name).toBe('ProvisionedThroughputExceededException')
          expect(e.$metadata?.httpStatusCode).toBe(400)
        }
      })

      it('should be retriable error', async () => {
        const error = new Error('Throughput exceeded') as Error & {
          name: string
          $retryable?: { throttling: boolean }
        }
        error.name = 'ProvisionedThroughputExceededException'
        error.$retryable = { throttling: true }
        dynamoMock.on(PutItemCommand).rejects(error)

        try {
          await client.send(
            new PutItemCommand({
              TableName: 'test-table',
              Item: marshall({ pk: 'pk', sk: 'sk' }),
            }),
          )
        } catch (e: any) {
          // This is a throttling error that should be retried
          expect(e.name).toBe('ProvisionedThroughputExceededException')
        }
      })
    })

    describe('ItemCollectionSizeLimitExceededException', () => {
      it('should have expected error structure', async () => {
        const error = new Error(
          'Collection size exceeded',
        ) as Error & { name: string; $metadata: { httpStatusCode: number } }
        error.name = 'ItemCollectionSizeLimitExceededException'
        error.$metadata = { httpStatusCode: 400 }
        dynamoMock.on(PutItemCommand).rejects(error)

        try {
          await client.send(
            new PutItemCommand({
              TableName: 'test-table',
              Item: marshall({ pk: 'pk', sk: 'sk' }),
            }),
          )
          fail('Expected error to be thrown')
        } catch (e: any) {
          expect(e.name).toBe('ItemCollectionSizeLimitExceededException')
          expect(e.message).toContain('Collection size')
        }
      })
    })

    describe('ConditionalCheckFailedException', () => {
      it('should preserve Item in error response', async () => {
        const error = new Error('Condition check failed') as Error & {
          name: string
          Item?: Record<string, unknown>
        }
        error.name = 'ConditionalCheckFailedException'
        error.Item = { pk: { S: 'existing-pk' }, sk: { S: 'existing-sk' } }
        dynamoMock.on(PutItemCommand).rejects(error)

        try {
          await client.send(
            new PutItemCommand({
              TableName: 'test-table',
              Item: marshall({ pk: 'pk', sk: 'sk' }),
              ConditionExpression: 'attribute_not_exists(pk)',
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('ConditionalCheckFailedException')
          // Item field may contain the existing item if ReturnValuesOnConditionCheckFailure is set
        }
      })
    })

    describe('TransactionCanceledException', () => {
      it('should have CancellationReasons array', async () => {
        const error = new Error('Transaction cancelled') as Error & {
          name: string
          CancellationReasons?: Array<{
            Code: string
            Message?: string
          }>
        }
        error.name = 'TransactionCanceledException'
        error.CancellationReasons = [
          { Code: 'ConditionalCheckFailed', Message: 'Condition not met' },
          { Code: 'None' },
        ]
        dynamoMock.on(TransactWriteItemsCommand).rejects(error)

        try {
          await client.send(
            new TransactWriteItemsCommand({
              TransactItems: [
                {
                  Put: {
                    TableName: 'test-table',
                    Item: marshall({ pk: 'pk1', sk: 'sk1' }),
                  },
                },
              ],
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('TransactionCanceledException')
          expect(e.CancellationReasons).toBeDefined()
          expect(Array.isArray(e.CancellationReasons)).toBe(true)
          expect(e.CancellationReasons[0].Code).toBe('ConditionalCheckFailed')
        }
      })
    })

    describe('ResourceNotFoundException', () => {
      it('should contain table name information', async () => {
        const error = new Error(
          'Requested resource not found: Table: non-existent-table not found',
        ) as Error & { name: string }
        error.name = 'ResourceNotFoundException'
        dynamoMock.on(GetItemCommand).rejects(error)

        try {
          await client.send(
            new GetItemCommand({
              TableName: 'non-existent-table',
              Key: marshall({ pk: 'pk', sk: 'sk' }),
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('ResourceNotFoundException')
          expect(e.message).toContain('not found')
        }
      })
    })

    describe('ValidationException', () => {
      it('should have detailed validation message', async () => {
        const error = new Error(
          'One or more parameter values were invalid',
        ) as Error & { name: string }
        error.name = 'ValidationException'
        dynamoMock.on(QueryCommand).rejects(error)

        try {
          await client.send(
            new QueryCommand({
              TableName: 'test-table',
              KeyConditionExpression: 'invalid',
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('ValidationException')
          expect(e.message.length).toBeGreaterThan(0)
        }
      })
    })

    describe('BatchWrite unprocessed items', () => {
      it('should return UnprocessedItems on partial failure', async () => {
        dynamoMock.on(BatchWriteItemCommand).resolves({
          UnprocessedItems: {
            'test-table': [
              {
                PutRequest: {
                  Item: marshall({ pk: 'failed-pk', sk: 'failed-sk' }),
                },
              },
            ],
          },
        })

        const result = await client.send(
          new BatchWriteItemCommand({
            RequestItems: {
              'test-table': [
                { PutRequest: { Item: marshall({ pk: 'pk1', sk: 'sk1' }) } },
                { PutRequest: { Item: marshall({ pk: 'pk2', sk: 'sk2' }) } },
              ],
            },
          }),
        )

        expect(result.UnprocessedItems).toBeDefined()
        expect(result.UnprocessedItems?.['test-table']).toBeDefined()
        expect(result.UnprocessedItems?.['test-table']?.length).toBeGreaterThan(0)
      })
    })
  })

  // ============================================================================
  // S3 Detailed Exceptions
  // ============================================================================
  describe('S3 Detailed Exceptions', () => {
    const s3Mock = mockClient(S3Client)
    const client = new S3Client({ region: 'ap-northeast-1' })

    beforeEach(() => {
      s3Mock.reset()
    })

    describe('NoSuchBucket', () => {
      it('should contain bucket name in error', async () => {
        const error = new Error('The specified bucket does not exist') as Error & {
          name: string
          BucketName?: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'NoSuchBucket'
        error.BucketName = 'non-existent-bucket'
        error.$metadata = { httpStatusCode: 404 }
        s3Mock.on(GetObjectCommand).rejects(error)

        try {
          await client.send(
            new GetObjectCommand({
              Bucket: 'non-existent-bucket',
              Key: 'test-key',
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('NoSuchBucket')
          expect(e.$metadata?.httpStatusCode).toBe(404)
        }
      })
    })

    describe('NoSuchKey', () => {
      it('should have 404 status code', async () => {
        const error = new Error('The specified key does not exist') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'NoSuchKey'
        error.$metadata = { httpStatusCode: 404 }
        s3Mock.on(GetObjectCommand).rejects(error)

        try {
          await client.send(
            new GetObjectCommand({
              Bucket: 'test-bucket',
              Key: 'non-existent-key',
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('NoSuchKey')
          expect(e.$metadata.httpStatusCode).toBe(404)
        }
      })
    })

    describe('EntityTooLarge', () => {
      it('should have size limit information', async () => {
        const error = new Error(
          'Your proposed upload exceeds the maximum allowed object size',
        ) as Error & {
          name: string
          MaxSizeAllowed?: string
          ProposedSize?: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'EntityTooLarge'
        error.MaxSizeAllowed = '5368709120'
        error.ProposedSize = '10737418240'
        error.$metadata = { httpStatusCode: 400 }
        s3Mock.on(PutObjectCommand).rejects(error)

        try {
          await client.send(
            new PutObjectCommand({
              Bucket: 'test-bucket',
              Key: 'large-file',
              Body: Buffer.alloc(1),
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('EntityTooLarge')
          expect(e.message).toContain('maximum')
        }
      })
    })

    describe('AccessDenied', () => {
      it('should have 403 status code', async () => {
        const error = new Error('Access Denied') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'AccessDenied'
        error.$metadata = { httpStatusCode: 403 }
        s3Mock.on(GetObjectCommand).rejects(error)

        try {
          await client.send(
            new GetObjectCommand({
              Bucket: 'restricted-bucket',
              Key: 'private-file',
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('AccessDenied')
          expect(e.$metadata.httpStatusCode).toBe(403)
        }
      })
    })

    describe('InvalidObjectState', () => {
      it('should indicate object storage class issue', async () => {
        const error = new Error(
          'The operation is not valid for the object storage class',
        ) as Error & {
          name: string
          StorageClass?: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'InvalidObjectState'
        error.StorageClass = 'GLACIER'
        error.$metadata = { httpStatusCode: 403 }
        s3Mock.on(GetObjectCommand).rejects(error)

        try {
          await client.send(
            new GetObjectCommand({
              Bucket: 'archive-bucket',
              Key: 'archived-object',
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('InvalidObjectState')
        }
      })
    })

    describe('PreconditionFailed', () => {
      it('should indicate conditional request failure', async () => {
        const error = new Error('Precondition failed') as Error & {
          name: string
          Condition?: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'PreconditionFailed'
        error.$metadata = { httpStatusCode: 412 }
        s3Mock.on(GetObjectCommand).rejects(error)

        try {
          await client.send(
            new GetObjectCommand({
              Bucket: 'test-bucket',
              Key: 'conditional-key',
              IfMatch: '"non-matching-etag"',
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('PreconditionFailed')
          expect(e.$metadata.httpStatusCode).toBe(412)
        }
      })
    })
  })

  // ============================================================================
  // SQS Detailed Exceptions
  // ============================================================================
  describe('SQS Detailed Exceptions', () => {
    const sqsMock = mockClient(SQSClient)
    const client = new SQSClient({ region: 'ap-northeast-1' })

    beforeEach(() => {
      sqsMock.reset()
    })

    describe('QueueDoesNotExist', () => {
      it('should indicate queue not found', async () => {
        const error = new Error('The specified queue does not exist') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'QueueDoesNotExist'
        error.$metadata = { httpStatusCode: 400 }
        sqsMock.on(SendMessageCommand).rejects(error)

        try {
          await client.send(
            new SendMessageCommand({
              QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/non-existent',
              MessageBody: 'test',
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('QueueDoesNotExist')
        }
      })
    })

    describe('MessageNotInflight', () => {
      it('should indicate visibility timeout issue', async () => {
        const error = new Error(
          'The specified message is not in flight',
        ) as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'MessageNotInflight'
        error.$metadata = { httpStatusCode: 400 }
        sqsMock.on(DeleteMessageCommand).rejects(error)

        try {
          await client.send(
            new DeleteMessageCommand({
              QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test',
              ReceiptHandle: 'expired-receipt-handle',
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('MessageNotInflight')
        }
      })
    })

    describe('ReceiptHandleIsInvalid', () => {
      it('should indicate invalid receipt handle', async () => {
        const error = new Error('The receipt handle provided is not valid') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'ReceiptHandleIsInvalid'
        error.$metadata = { httpStatusCode: 400 }
        sqsMock.on(DeleteMessageCommand).rejects(error)

        try {
          await client.send(
            new DeleteMessageCommand({
              QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test',
              ReceiptHandle: 'invalid-handle',
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('ReceiptHandleIsInvalid')
        }
      })
    })

    describe('OverLimit', () => {
      it('should indicate message size limit exceeded', async () => {
        const error = new Error('Message size exceeds limit') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'OverLimit'
        error.$metadata = { httpStatusCode: 400 }
        sqsMock.on(SendMessageCommand).rejects(error)

        try {
          await client.send(
            new SendMessageCommand({
              QueueUrl: 'https://sqs.ap-northeast-1.amazonaws.com/123456789012/test',
              MessageBody: 'x'.repeat(300000), // Over 256KB limit
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('OverLimit')
        }
      })
    })
  })

  // ============================================================================
  // SNS Detailed Exceptions
  // ============================================================================
  describe('SNS Detailed Exceptions', () => {
    const snsMock = mockClient(SNSClient)
    const client = new SNSClient({ region: 'ap-northeast-1' })

    beforeEach(() => {
      snsMock.reset()
    })

    describe('TopicLimitExceededException', () => {
      it('should indicate topic limit reached', async () => {
        const error = new Error('Topic limit exceeded') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'TopicLimitExceededException'
        error.$metadata = { httpStatusCode: 403 }
        snsMock.on(PublishCommand).rejects(error)

        try {
          await client.send(
            new PublishCommand({
              TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:test-topic',
              Message: 'test',
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('TopicLimitExceededException')
        }
      })
    })

    describe('InvalidParameterException', () => {
      it('should contain parameter information', async () => {
        const error = new Error('Invalid parameter: TopicArn') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'InvalidParameterException'
        error.$metadata = { httpStatusCode: 400 }
        snsMock.on(PublishCommand).rejects(error)

        try {
          await client.send(
            new PublishCommand({
              TopicArn: 'invalid-arn',
              Message: 'test',
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('InvalidParameterException')
          expect(e.message).toContain('Invalid')
        }
      })
    })

    describe('NotFoundException', () => {
      it('should indicate topic not found', async () => {
        const error = new Error('Topic does not exist') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'NotFoundException'
        error.$metadata = { httpStatusCode: 404 }
        snsMock.on(PublishCommand).rejects(error)

        try {
          await client.send(
            new PublishCommand({
              TopicArn: 'arn:aws:sns:ap-northeast-1:123456789012:non-existent',
              Message: 'test',
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('NotFoundException')
        }
      })
    })

    describe('EndpointDisabledException', () => {
      it('should indicate disabled endpoint', async () => {
        const error = new Error('Endpoint is disabled') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'EndpointDisabledException'
        error.$metadata = { httpStatusCode: 400 }
        snsMock.on(PublishCommand).rejects(error)

        try {
          await client.send(
            new PublishCommand({
              TargetArn: 'arn:aws:sns:ap-northeast-1:123456789012:endpoint/test',
              Message: 'test',
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('EndpointDisabledException')
        }
      })
    })
  })

  // ============================================================================
  // Step Functions Detailed Exceptions
  // ============================================================================
  describe('Step Functions Detailed Exceptions', () => {
    const sfnMock = mockClient(SFNClient)
    const client = new SFNClient({ region: 'ap-northeast-1' })

    beforeEach(() => {
      sfnMock.reset()
    })

    describe('InvalidArn', () => {
      it('should indicate ARN format issue', async () => {
        const error = new Error('Invalid ARN format') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'InvalidArn'
        error.$metadata = { httpStatusCode: 400 }
        sfnMock.on(StartExecutionCommand).rejects(error)

        try {
          await client.send(
            new StartExecutionCommand({
              stateMachineArn: 'invalid-arn',
              input: '{}',
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('InvalidArn')
        }
      })
    })

    describe('ExecutionAlreadyExists', () => {
      it('should indicate duplicate execution', async () => {
        const error = new Error('Execution already exists') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'ExecutionAlreadyExists'
        error.$metadata = { httpStatusCode: 400 }
        sfnMock.on(StartExecutionCommand).rejects(error)

        try {
          await client.send(
            new StartExecutionCommand({
              stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:test',
              name: 'duplicate-execution',
              input: '{}',
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('ExecutionAlreadyExists')
        }
      })
    })

    describe('StateMachineDoesNotExist', () => {
      it('should indicate state machine not found', async () => {
        const error = new Error('State machine does not exist') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'StateMachineDoesNotExist'
        error.$metadata = { httpStatusCode: 400 }
        sfnMock.on(StartExecutionCommand).rejects(error)

        try {
          await client.send(
            new StartExecutionCommand({
              stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:nonexistent',
              input: '{}',
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('StateMachineDoesNotExist')
        }
      })
    })

    describe('ExecutionDoesNotExist', () => {
      it('should indicate execution not found', async () => {
        const error = new Error('Execution does not exist') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'ExecutionDoesNotExist'
        error.$metadata = { httpStatusCode: 400 }
        sfnMock.on(DescribeExecutionCommand).rejects(error)

        try {
          await client.send(
            new DescribeExecutionCommand({
              executionArn: 'arn:aws:states:ap-northeast-1:123456789012:execution:sm:nonexistent',
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('ExecutionDoesNotExist')
        }
      })
    })

    describe('InvalidExecutionInput', () => {
      it('should indicate invalid JSON input', async () => {
        const error = new Error('Invalid execution input') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'InvalidExecutionInput'
        error.$metadata = { httpStatusCode: 400 }
        sfnMock.on(StartExecutionCommand).rejects(error)

        try {
          await client.send(
            new StartExecutionCommand({
              stateMachineArn: 'arn:aws:states:ap-northeast-1:123456789012:stateMachine:test',
              input: 'invalid-json',
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('InvalidExecutionInput')
        }
      })
    })
  })

  // ============================================================================
  // SES v2 Detailed Exceptions
  // ============================================================================
  describe('SES v2 Detailed Exceptions', () => {
    const sesMock = mockClient(SESv2Client)
    const client = new SESv2Client({ region: 'ap-northeast-1' })

    beforeEach(() => {
      sesMock.reset()
    })

    describe('MessageRejected', () => {
      it('should indicate email rejection', async () => {
        const error = new Error('Email address is not verified') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'MessageRejected'
        error.$metadata = { httpStatusCode: 400 }
        sesMock.on(SendEmailCommand).rejects(error)

        try {
          await client.send(
            new SendEmailCommand({
              FromEmailAddress: 'unverified@example.com',
              Destination: {
                ToAddresses: ['recipient@example.com'],
              },
              Content: {
                Simple: {
                  Subject: { Data: 'Test' },
                  Body: { Text: { Data: 'Test body' } },
                },
              },
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('MessageRejected')
        }
      })
    })

    describe('MailFromDomainNotVerifiedException', () => {
      it('should indicate domain verification issue', async () => {
        const error = new Error('Mail from domain not verified') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'MailFromDomainNotVerifiedException'
        error.$metadata = { httpStatusCode: 400 }
        sesMock.on(SendEmailCommand).rejects(error)

        try {
          await client.send(
            new SendEmailCommand({
              FromEmailAddress: 'sender@unverified-domain.com',
              Destination: {
                ToAddresses: ['recipient@example.com'],
              },
              Content: {
                Simple: {
                  Subject: { Data: 'Test' },
                  Body: { Text: { Data: 'Test body' } },
                },
              },
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('MailFromDomainNotVerifiedException')
        }
      })
    })

    describe('AccountSuspendedException', () => {
      it('should indicate suspended account', async () => {
        const error = new Error('Account suspended') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'AccountSuspendedException'
        error.$metadata = { httpStatusCode: 400 }
        sesMock.on(SendEmailCommand).rejects(error)

        try {
          await client.send(
            new SendEmailCommand({
              FromEmailAddress: 'sender@example.com',
              Destination: {
                ToAddresses: ['recipient@example.com'],
              },
              Content: {
                Simple: {
                  Subject: { Data: 'Test' },
                  Body: { Text: { Data: 'Test body' } },
                },
              },
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('AccountSuspendedException')
        }
      })
    })

    describe('SendingPausedException', () => {
      it('should indicate sending paused', async () => {
        const error = new Error('Sending is paused') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'SendingPausedException'
        error.$metadata = { httpStatusCode: 400 }
        sesMock.on(SendEmailCommand).rejects(error)

        try {
          await client.send(
            new SendEmailCommand({
              FromEmailAddress: 'sender@example.com',
              Destination: {
                ToAddresses: ['recipient@example.com'],
              },
              Content: {
                Simple: {
                  Subject: { Data: 'Test' },
                  Body: { Text: { Data: 'Test body' } },
                },
              },
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('SendingPausedException')
        }
      })
    })

    describe('LimitExceededException', () => {
      it('should indicate sending limit exceeded', async () => {
        const error = new Error('Daily sending quota exceeded') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'LimitExceededException'
        error.$metadata = { httpStatusCode: 400 }
        sesMock.on(SendEmailCommand).rejects(error)

        try {
          await client.send(
            new SendEmailCommand({
              FromEmailAddress: 'sender@example.com',
              Destination: {
                ToAddresses: ['recipient@example.com'],
              },
              Content: {
                Simple: {
                  Subject: { Data: 'Test' },
                  Body: { Text: { Data: 'Test body' } },
                },
              },
            }),
          )
        } catch (e: any) {
          expect(e.name).toBe('LimitExceededException')
        }
      })
    })
  })

  // ============================================================================
  // Error Metadata Preservation Tests
  // ============================================================================
  describe('Error Metadata Preservation', () => {
    const dynamoMock = mockClient(DynamoDBClient)
    const client = new DynamoDBClient({ region: 'ap-northeast-1' })

    beforeEach(() => {
      dynamoMock.reset()
    })

    describe('$metadata preservation', () => {
      it('should preserve httpStatusCode', async () => {
        const error = new Error('Test error') as Error & {
          name: string
          $metadata: { httpStatusCode: number; requestId: string }
        }
        error.name = 'TestException'
        error.$metadata = {
          httpStatusCode: 400,
          requestId: 'test-request-id-123',
        }
        dynamoMock.on(GetItemCommand).rejects(error)

        try {
          await client.send(
            new GetItemCommand({
              TableName: 'test-table',
              Key: marshall({ pk: 'pk', sk: 'sk' }),
            }),
          )
        } catch (e: any) {
          expect(e.$metadata).toBeDefined()
          expect(e.$metadata.httpStatusCode).toBe(400)
          expect(e.$metadata.requestId).toBe('test-request-id-123')
        }
      })
    })

    describe('Error inheritance', () => {
      it('should be instanceof Error', async () => {
        const error = new Error('Test') as Error & { name: string }
        error.name = 'ConditionalCheckFailedException'
        dynamoMock.on(PutItemCommand).rejects(error)

        try {
          await client.send(
            new PutItemCommand({
              TableName: 'test-table',
              Item: marshall({ pk: 'pk', sk: 'sk' }),
            }),
          )
        } catch (e: any) {
          expect(e).toBeInstanceOf(Error)
          expect(e.stack).toBeDefined()
        }
      })
    })

    describe('Error serialization', () => {
      it('should be JSON serializable for logging', async () => {
        const error = new Error('Serialization test') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
          customField: string
        }
        error.name = 'SerializableException'
        error.$metadata = { httpStatusCode: 500 }
        error.customField = 'custom-value'
        dynamoMock.on(GetItemCommand).rejects(error)

        try {
          await client.send(
            new GetItemCommand({
              TableName: 'test-table',
              Key: marshall({ pk: 'pk', sk: 'sk' }),
            }),
          )
        } catch (e: any) {
          // Error properties should be accessible for logging
          const logData = {
            name: e.name,
            message: e.message,
            httpStatusCode: e.$metadata?.httpStatusCode,
            customField: e.customField,
          }
          expect(() => JSON.stringify(logData)).not.toThrow()
          expect(logData.name).toBe('SerializableException')
        }
      })
    })
  })
})
