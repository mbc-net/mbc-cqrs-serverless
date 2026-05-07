/**
 * Utilities Demo Test
 *
 * This file demonstrates how to use the shared test utilities
 * for writing cleaner, more maintainable integration tests.
 *
 * Compare with older test files to see the reduction in boilerplate.
 */
import { GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import 'aws-sdk-client-mock-jest'

import {
  // Error Factory
  createDynamoDBError,
  createS3Error,
  createNetworkError,
  // Mock Manager
  createDynamoDBMock,
  createS3Mock,
  // Test Data Builders
  createTestItem,
  createTestItems,
  createMarshalledItem,
  marshall,
  // Test Assertions
  assertIsRetriableError,
  assertIsNotRetriableError,
  assertErrorMetadata,
  assertArrayLength,
} from './utilities'

describe('Utilities Demo - Cleaner Integration Tests', () => {
  // ============================================================================
  // Using createDynamoDBMock for cleaner setup
  // ============================================================================
  describe('DynamoDB with Mock Manager', () => {
    // Clean setup using utility
    const dynamoDB = createDynamoDBMock()

    beforeEach(() => {
      dynamoDB.reset()
    })

    afterAll(() => {
      dynamoDB.restore()
    })

    describe('Error handling with Error Factory', () => {
      it('should handle ValidationException (non-retriable)', async () => {
        // OLD WAY (verbose):
        // const error = new Error('Validation error') as Error & {
        //   name: string
        //   $metadata: { httpStatusCode: number }
        // }
        // error.name = 'ValidationException'
        // error.$metadata = { httpStatusCode: 400 }

        // NEW WAY (using factory):
        const error = createDynamoDBError('ValidationException', {
          message: 'Invalid item format',
        })

        dynamoDB.mock.on(GetItemCommand).rejects(error)

        await expect(
          dynamoDB.client.send(
            new GetItemCommand({
              TableName: 'test-table',
              Key: createMarshalledItem({ pk: 'test', sk: 'item' }),
            }),
          ),
        ).rejects.toThrow('Invalid item format')

        // Using assertion utility
        assertIsNotRetriableError(error)
        assertErrorMetadata(error, { httpStatusCode: 400, name: 'ValidationException' })
      })

      it('should handle ProvisionedThroughputExceededException (retriable)', async () => {
        const error = createDynamoDBError('ProvisionedThroughputExceededException', {
          message: 'Rate exceeded',
          retryAfterSeconds: 5,
        })

        dynamoDB.mock.on(PutItemCommand).rejects(error)

        await expect(
          dynamoDB.client.send(
            new PutItemCommand({
              TableName: 'test-table',
              Item: createMarshalledItem({ pk: 'test', sk: 'item' }),
            }),
          ),
        ).rejects.toThrow('Rate exceeded')

        assertIsRetriableError(error)
        expect(error.retryAfterSeconds).toBe(5)
      })
    })

    describe('Data handling with Data Builders', () => {
      it('should process batch items efficiently', async () => {
        // OLD WAY (verbose):
        // const items = Array.from({ length: 10 }, (_, i) => ({
        //   pk: `pk-${i}`,
        //   sk: `sk-${i}`,
        //   data: `data-${i}`,
        // }))

        // NEW WAY (using builder):
        const items = createTestItems(10, {
          pkPrefix: 'user',
          skPrefix: 'profile',
          dataGenerator: (i) => ({ name: `User ${i}`, score: i * 10 }),
        })

        assertArrayLength(items, 10)
        expect(items[0].pk).toBe('user-0')
        expect(items[0].name).toBe('User 0')
        expect(items[5].score).toBe(50)
      })

      it('should create item with timestamp and version', () => {
        const item = createTestItem({
          pk: 'order-123',
          sk: 'detail',
          data: { amount: 1000, currency: 'JPY' },
          withTimestamp: true,
          withVersion: 1,
        })

        expect(item.pk).toBe('order-123')
        expect(item.createdAt).toBeDefined()
        expect(item.version).toBe(1)
        expect(item.amount).toBe(1000)
      })
    })
  })

  // ============================================================================
  // Using createS3Mock
  // ============================================================================
  describe('S3 with Mock Manager', () => {
    const s3 = createS3Mock()

    beforeEach(() => {
      s3.reset()
    })

    afterAll(() => {
      s3.restore()
    })

    describe('Error handling', () => {
      it('should handle NoSuchKey error', async () => {
        const error = createS3Error('NoSuchKey', {
          message: 'The specified key does not exist',
        })

        s3.mock.on(GetObjectCommand).rejects(error)

        await expect(
          s3.client.send(
            new GetObjectCommand({
              Bucket: 'my-bucket',
              Key: 'non-existent-key',
            }),
          ),
        ).rejects.toThrow('The specified key does not exist')

        assertErrorMetadata(error, { httpStatusCode: 404 })
      })

      it('should handle SlowDown (throttling) error', async () => {
        const error = createS3Error('SlowDown', {
          message: 'Please reduce your request rate',
        })

        s3.mock.on(GetObjectCommand).rejects(error)

        await expect(
          s3.client.send(
            new GetObjectCommand({
              Bucket: 'my-bucket',
              Key: 'some-key',
            }),
          ),
        ).rejects.toThrow('Please reduce your request rate')

        assertIsRetriableError(error)
      })
    })
  })

  // ============================================================================
  // Using Error Classification
  // ============================================================================
  describe('Error Classification', () => {
    describe('DynamoDB errors', () => {
      const testCases = [
        { name: 'ProvisionedThroughputExceededException' as const, retriable: true },
        { name: 'ThrottlingException' as const, retriable: true },
        { name: 'InternalServerError' as const, retriable: true },
        { name: 'ValidationException' as const, retriable: false },
        { name: 'ConditionalCheckFailedException' as const, retriable: false },
        { name: 'ResourceNotFoundException' as const, retriable: false },
      ]

      testCases.forEach(({ name, retriable }) => {
        it(`should classify ${name} as ${retriable ? 'retriable' : 'non-retriable'}`, () => {
          const error = createDynamoDBError(name)

          if (retriable) {
            assertIsRetriableError(error)
          } else {
            assertIsNotRetriableError(error)
          }
        })
      })
    })

    describe('Network errors', () => {
      const networkErrorCodes = [
        'ECONNRESET',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENETUNREACH',
      ] as const

      networkErrorCodes.forEach((code) => {
        it(`should create ${code} network error`, () => {
          const error = createNetworkError(code)

          expect(error.code).toBe(code)
          expect(error.message).toBeDefined()
        })
      })
    })
  })

  // ============================================================================
  // Demonstrating Test Data Builders
  // ============================================================================
  describe('Test Data Builders', () => {
    it('should create marshalled items for DynamoDB operations', () => {
      // Create a single marshalled item
      const item = createMarshalledItem({
        pk: 'USER#123',
        sk: 'PROFILE',
        data: {
          name: 'John Doe',
          email: 'john@example.com',
          age: 30,
        },
      })

      expect(item.pk).toEqual({ S: 'USER#123' })
      expect(item.sk).toEqual({ S: 'PROFILE' })
      expect(item.name).toEqual({ S: 'John Doe' })
      expect(item.age).toEqual({ N: '30' })
    })

    it('should create test items with custom generator', () => {
      const orders = createTestItems(5, {
        pkPrefix: 'ORDER',
        skPrefix: 'ITEM',
        dataGenerator: (i) => ({
          productId: `PROD-${i}`,
          quantity: (i + 1) * 2,
          price: (i + 1) * 100,
        }),
        withTimestamp: true,
      })

      expect(orders).toHaveLength(5)
      expect(orders[0].productId).toBe('PROD-0')
      expect(orders[0].quantity).toBe(2)
      expect(orders[4].price).toBe(500)
      expect(orders[0].createdAt).toBeDefined()
    })

    it('should handle complex nested data', () => {
      const item = createTestItem({
        pk: 'TENANT#abc',
        sk: 'CONFIG',
        data: {
          settings: {
            feature: {
              enabled: true,
              options: ['a', 'b', 'c'],
            },
          },
          metadata: {
            version: 1,
            updatedBy: 'admin',
          },
        },
      })

      const settings = item.settings as { feature: { enabled: boolean; options: string[] } }
      const metadata = item.metadata as { version: number }

      expect(settings.feature.enabled).toBe(true)
      expect(settings.feature.options).toHaveLength(3)
      expect(metadata.version).toBe(1)

      // Can be marshalled for DynamoDB
      const marshalled = marshall(item)
      expect(marshalled.pk).toEqual({ S: 'TENANT#abc' })
    })
  })
})
