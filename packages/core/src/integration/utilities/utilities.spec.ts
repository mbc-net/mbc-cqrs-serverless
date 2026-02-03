/**
 * Integration Test Utilities Tests
 *
 * Tests for the shared utility modules to ensure they work correctly
 * and detect breaking changes in the utility APIs.
 */
import {
  // AWS Error Factory
  createDynamoDBError,
  createS3Error,
  createSQSError,
  createSNSError,
  createSFNError,
  createSESError,
  createNetworkError,
  createTimeoutError,
  createHttpStatusError,
  isRetriableAWSError,
  isThrottlingError,
  isNetworkError,
  // Test Data Builders
  createTestItem,
  createTestItems,
  createMarshalledItem,
  createMarshalledItems,
  createKey,
  createKeys,
  splitIntoBatches,
  createS3Content,
  createRandomString,
  createNestedTestData,
  createMixedTypeTestData,
  createLargeTestData,
  DYNAMODB_BATCH_SIZE,
  // Test Assertions
  assertIsRetriableError,
  assertIsNotRetriableError,
  assertIsThrottlingError,
  assertIsNetworkError,
  assertIsTimeoutError,
  assertErrorMetadata,
  assertArrayLength,
  assertAllMatch,
} from './index'

describe('Integration Test Utilities', () => {
  // ============================================================================
  // AWS Error Factory Tests
  // ============================================================================
  describe('AWS Error Factory', () => {
    describe('createDynamoDBError', () => {
      it('should create ProvisionedThroughputExceededException', () => {
        const error = createDynamoDBError(
          'ProvisionedThroughputExceededException',
          { message: 'Rate exceeded' },
        )

        expect(error.name).toBe('ProvisionedThroughputExceededException')
        expect(error.message).toBe('Rate exceeded')
        expect(error.$metadata.httpStatusCode).toBe(400)
        expect(error.$retryable?.throttling).toBe(true)
        expect(error.$service).toBe('DynamoDB')
      })

      it('should create InternalServerError with server fault', () => {
        const error = createDynamoDBError('InternalServerError')

        expect(error.name).toBe('InternalServerError')
        expect(error.$metadata.httpStatusCode).toBe(500)
        expect(error.$fault).toBe('server')
      })

      it('should create ValidationException with client fault', () => {
        const error = createDynamoDBError('ValidationException')

        expect(error.name).toBe('ValidationException')
        expect(error.$metadata.httpStatusCode).toBe(400)
        expect(error.$fault).toBe('client')
      })

      it('should allow custom options to override defaults', () => {
        const error = createDynamoDBError(
          'ProvisionedThroughputExceededException',
          {
            httpStatusCode: 503,
            requestId: 'custom-request-id',
            retryAfterSeconds: 10,
          },
        )

        expect(error.$metadata.httpStatusCode).toBe(503)
        expect(error.$metadata.requestId).toBe('custom-request-id')
        expect(error.retryAfterSeconds).toBe(10)
      })
    })

    describe('createS3Error', () => {
      it('should create NoSuchKey with 404 status', () => {
        const error = createS3Error('NoSuchKey')

        expect(error.name).toBe('NoSuchKey')
        expect(error.$metadata.httpStatusCode).toBe(404)
        expect(error.$service).toBe('S3')
      })

      it('should create SlowDown as throttling error', () => {
        const error = createS3Error('SlowDown')

        expect(error.name).toBe('SlowDown')
        expect(error.$retryable?.throttling).toBe(true)
      })

      it('should create AccessDenied with 403 status', () => {
        const error = createS3Error('AccessDenied')

        expect(error.$metadata.httpStatusCode).toBe(403)
      })
    })

    describe('createSQSError', () => {
      it('should create QueueDoesNotExist', () => {
        const error = createSQSError('QueueDoesNotExist')

        expect(error.name).toBe('QueueDoesNotExist')
        expect(error.$service).toBe('SQS')
      })

      it('should create ThrottlingException as throttling error', () => {
        const error = createSQSError('ThrottlingException')

        expect(error.$retryable?.throttling).toBe(true)
      })
    })

    describe('createSNSError', () => {
      it('should create NotFoundException', () => {
        const error = createSNSError('NotFoundException')

        expect(error.name).toBe('NotFoundException')
        expect(error.$metadata.httpStatusCode).toBe(404)
        expect(error.$service).toBe('SNS')
      })
    })

    describe('createSFNError', () => {
      it('should create ExecutionDoesNotExist', () => {
        const error = createSFNError('ExecutionDoesNotExist')

        expect(error.name).toBe('ExecutionDoesNotExist')
        expect(error.$service).toBe('StepFunctions')
      })

      it('should create ThrottlingException as throttling error', () => {
        const error = createSFNError('ThrottlingException')

        expect(error.$retryable?.throttling).toBe(true)
      })
    })

    describe('createSESError', () => {
      it('should create MessageRejected', () => {
        const error = createSESError('MessageRejected')

        expect(error.name).toBe('MessageRejected')
        expect(error.$service).toBe('SES')
      })

      it('should create TooManyRequestsException as throttling error', () => {
        const error = createSESError('TooManyRequestsException')

        expect(error.$retryable?.throttling).toBe(true)
        expect(error.$metadata.httpStatusCode).toBe(429)
      })
    })

    describe('createNetworkError', () => {
      it('should create ECONNRESET error', () => {
        const error = createNetworkError('ECONNRESET')

        expect(error.code).toBe('ECONNRESET')
        expect(error.message).toContain('ECONNRESET')
      })

      it('should create ETIMEDOUT error', () => {
        const error = createNetworkError('ETIMEDOUT')

        expect(error.code).toBe('ETIMEDOUT')
      })

      it('should use custom message', () => {
        const error = createNetworkError('ECONNRESET', 'Custom message')

        expect(error.message).toBe('Custom message')
      })
    })

    describe('createTimeoutError', () => {
      it('should create timeout error', () => {
        const error = createTimeoutError()

        expect(error.name).toBe('TimeoutError')
        expect(error.code).toBe('ETIMEDOUT')
      })
    })

    describe('createHttpStatusError', () => {
      it('should create 500 error as server fault', () => {
        const error = createHttpStatusError(500)

        expect(error.$metadata.httpStatusCode).toBe(500)
        expect(error.$fault).toBe('server')
      })

      it('should create 429 error as throttling', () => {
        const error = createHttpStatusError(429)

        expect(error.$retryable?.throttling).toBe(true)
      })

      it('should create 400 error as client fault', () => {
        const error = createHttpStatusError(400)

        expect(error.$fault).toBe('client')
      })
    })

    describe('isRetriableAWSError', () => {
      it('should return true for throttling errors', () => {
        const error = createDynamoDBError('ProvisionedThroughputExceededException')
        expect(isRetriableAWSError(error)).toBe(true)
      })

      it('should return true for 5xx errors', () => {
        const error = createHttpStatusError(500)
        expect(isRetriableAWSError(error)).toBe(true)
      })

      it('should return true for 429 errors', () => {
        const error = createHttpStatusError(429)
        expect(isRetriableAWSError(error)).toBe(true)
      })

      it('should return false for validation errors', () => {
        const error = createDynamoDBError('ValidationException')
        expect(isRetriableAWSError(error)).toBe(false)
      })
    })

    describe('isThrottlingError', () => {
      it('should return true for throttling errors', () => {
        const error = createDynamoDBError('ProvisionedThroughputExceededException')
        expect(isThrottlingError(error)).toBe(true)
      })

      it('should return false for non-throttling errors', () => {
        const error = createDynamoDBError('InternalServerError')
        expect(isThrottlingError(error)).toBe(false)
      })
    })

    describe('isNetworkError', () => {
      it('should return true for network errors', () => {
        const error = createNetworkError('ECONNRESET')
        expect(isNetworkError(error)).toBe(true)
      })

      it('should return true for socket hang up', () => {
        const error = new Error('socket hang up')
        expect(isNetworkError(error)).toBe(true)
      })

      it('should return false for application errors', () => {
        const error = new Error('Application error')
        expect(isNetworkError(error)).toBe(false)
      })
    })
  })

  // ============================================================================
  // Test Data Builders Tests
  // ============================================================================
  describe('Test Data Builders', () => {
    describe('createTestItem', () => {
      it('should create item with default pk and sk', () => {
        const item = createTestItem()

        expect(item.pk).toBeDefined()
        expect(item.sk).toBeDefined()
        expect(item.pk).toContain('pk-')
        expect(item.sk).toContain('sk-')
      })

      it('should create item with custom pk and sk', () => {
        const item = createTestItem({ pk: 'custom-pk', sk: 'custom-sk' })

        expect(item.pk).toBe('custom-pk')
        expect(item.sk).toBe('custom-sk')
      })

      it('should add timestamp when requested', () => {
        const item = createTestItem({ withTimestamp: true })

        expect(item.createdAt).toBeDefined()
        expect(item.updatedAt).toBeDefined()
      })

      it('should add version when specified', () => {
        const item = createTestItem({ withVersion: 5 })

        expect(item.version).toBe(5)
      })

      it('should merge custom data', () => {
        const item = createTestItem({
          pk: 'pk',
          sk: 'sk',
          data: { custom: 'value', number: 42 },
        })

        expect(item.custom).toBe('value')
        expect(item.number).toBe(42)
      })
    })

    describe('createTestItems', () => {
      it('should create specified number of items', () => {
        const items = createTestItems(10)

        expect(items).toHaveLength(10)
      })

      it('should create items with sequential IDs', () => {
        const items = createTestItems(3, {
          pkPrefix: 'user',
          skPrefix: 'profile',
        })

        expect(items[0].pk).toBe('user-0')
        expect(items[0].sk).toBe('profile-0')
        expect(items[1].pk).toBe('user-1')
        expect(items[2].pk).toBe('user-2')
      })

      it('should use data generator', () => {
        const items = createTestItems(3, {
          dataGenerator: (i) => ({ index: i, doubled: i * 2 }),
        })

        expect(items[0].index).toBe(0)
        expect(items[0].doubled).toBe(0)
        expect(items[2].index).toBe(2)
        expect(items[2].doubled).toBe(4)
      })
    })

    describe('createMarshalledItem', () => {
      it('should return DynamoDB AttributeValue format', () => {
        const item = createMarshalledItem({ pk: 'pk', sk: 'sk' })

        expect(item.pk).toEqual({ S: 'pk' })
        expect(item.sk).toEqual({ S: 'sk' })
      })
    })

    describe('createMarshalledItems', () => {
      it('should return array of marshalled items', () => {
        const items = createMarshalledItems(2)

        expect(items).toHaveLength(2)
        expect(items[0].pk).toHaveProperty('S')
      })
    })

    describe('createKey', () => {
      it('should create marshalled key', () => {
        const key = createKey('pk-value', 'sk-value')

        expect(key.pk).toEqual({ S: 'pk-value' })
        expect(key.sk).toEqual({ S: 'sk-value' })
      })
    })

    describe('createKeys', () => {
      it('should create multiple keys', () => {
        const keys = createKeys([
          { pk: 'pk-1', sk: 'sk-1' },
          { pk: 'pk-2', sk: 'sk-2' },
        ])

        expect(keys).toHaveLength(2)
        expect(keys[0].pk).toEqual({ S: 'pk-1' })
      })
    })

    describe('splitIntoBatches', () => {
      it('should split array into batches of default size', () => {
        const items = Array.from({ length: 60 }, (_, i) => i)
        const batches = splitIntoBatches(items)

        expect(batches).toHaveLength(3)
        expect(batches[0]).toHaveLength(DYNAMODB_BATCH_SIZE)
        expect(batches[1]).toHaveLength(DYNAMODB_BATCH_SIZE)
        expect(batches[2]).toHaveLength(10)
      })

      it('should split into custom batch size', () => {
        const items = [1, 2, 3, 4, 5, 6, 7]
        const batches = splitIntoBatches(items, 3)

        expect(batches).toHaveLength(3)
        expect(batches[0]).toEqual([1, 2, 3])
        expect(batches[1]).toEqual([4, 5, 6])
        expect(batches[2]).toEqual([7])
      })

      it('should handle empty array', () => {
        const batches = splitIntoBatches([])

        expect(batches).toHaveLength(0)
      })
    })

    describe('createS3Content', () => {
      it('should create text content', () => {
        const content = createS3Content({ type: 'text', size: 100 })

        expect(content).toBeInstanceOf(Buffer)
        expect(content.length).toBe(100)
      })

      it('should create JSON content', () => {
        const content = createS3Content({
          type: 'json',
          data: { key: 'value' },
        })

        const parsed = JSON.parse(content.toString())
        expect(parsed.key).toBe('value')
      })

      it('should create binary content', () => {
        const content = createS3Content({ type: 'binary', size: 50 })

        expect(content.length).toBe(50)
        expect(content[0]).toBe(0xff)
      })
    })

    describe('createRandomString', () => {
      it('should create string of specified length', () => {
        const str = createRandomString(20)

        expect(str).toHaveLength(20)
      })

      it('should contain only alphanumeric characters', () => {
        const str = createRandomString(100)

        expect(str).toMatch(/^[A-Za-z0-9]+$/)
      })
    })

    describe('createNestedTestData', () => {
      it('should create nested data with specified depth', () => {
        const data = createNestedTestData(2, 2)

        expect(data).toHaveProperty('level_2_item_0')
        expect(data.level_2_item_0).toHaveProperty('level_1_item_0')
      })

      it('should stop at depth 0 with value', () => {
        const data = createNestedTestData(0)

        expect(data).toHaveProperty('value')
      })
    })

    describe('createMixedTypeTestData', () => {
      it('should create data with various types', () => {
        const data = createMixedTypeTestData()

        expect(typeof data.stringValue).toBe('string')
        expect(typeof data.numberValue).toBe('number')
        expect(typeof data.booleanTrue).toBe('boolean')
        expect(data.nullValue).toBeNull()
        expect(Array.isArray(data.arrayValue)).toBe(true)
        expect(typeof data.objectValue).toBe('object')
      })
    })

    describe('createLargeTestData', () => {
      it('should create data with specified item count', () => {
        const data = createLargeTestData({ itemCount: 50 })

        expect(data.items).toHaveLength(50)
        expect((data.metadata as { totalCount: number }).totalCount).toBe(50)
      })
    })
  })

  // ============================================================================
  // Test Assertions Tests
  // ============================================================================
  describe('Test Assertions', () => {
    describe('assertIsRetriableError', () => {
      it('should pass for retriable errors', () => {
        const error = createDynamoDBError('ProvisionedThroughputExceededException')

        expect(() => assertIsRetriableError(error)).not.toThrow()
      })

      it('should throw for non-retriable errors', () => {
        const error = createDynamoDBError('ValidationException')

        expect(() => assertIsRetriableError(error)).toThrow()
      })
    })

    describe('assertIsNotRetriableError', () => {
      it('should pass for non-retriable errors', () => {
        const error = createDynamoDBError('ValidationException')

        expect(() => assertIsNotRetriableError(error)).not.toThrow()
      })

      it('should throw for retriable errors', () => {
        const error = createHttpStatusError(500)

        expect(() => assertIsNotRetriableError(error)).toThrow()
      })
    })

    describe('assertIsThrottlingError', () => {
      it('should pass for throttling errors', () => {
        const error = createDynamoDBError('ProvisionedThroughputExceededException')

        expect(() => assertIsThrottlingError(error)).not.toThrow()
      })

      it('should throw for non-throttling errors', () => {
        const error = createDynamoDBError('InternalServerError')

        expect(() => assertIsThrottlingError(error)).toThrow()
      })
    })

    describe('assertIsNetworkError', () => {
      it('should pass for network errors', () => {
        const error = createNetworkError('ECONNRESET')

        expect(() => assertIsNetworkError(error)).not.toThrow()
      })

      it('should throw for non-network errors', () => {
        const error = new Error('Application error')

        expect(() => assertIsNetworkError(error)).toThrow()
      })
    })

    describe('assertIsTimeoutError', () => {
      it('should pass for timeout errors', () => {
        const error = createTimeoutError()

        expect(() => assertIsTimeoutError(error)).not.toThrow()
      })

      it('should throw for non-timeout errors', () => {
        const error = new Error('Other error')

        expect(() => assertIsTimeoutError(error)).toThrow()
      })
    })

    describe('assertErrorMetadata', () => {
      it('should pass when metadata matches', () => {
        const error = createDynamoDBError('ValidationException')

        expect(() =>
          assertErrorMetadata(error, {
            httpStatusCode: 400,
            name: 'ValidationException',
          }),
        ).not.toThrow()
      })

      it('should throw when httpStatusCode does not match', () => {
        const error = createDynamoDBError('ValidationException')

        expect(() =>
          assertErrorMetadata(error, { httpStatusCode: 500 }),
        ).toThrow()
      })
    })

    describe('assertArrayLength', () => {
      it('should pass for correct length', () => {
        expect(() => assertArrayLength([1, 2, 3], 3)).not.toThrow()
      })

      it('should throw for incorrect length', () => {
        expect(() => assertArrayLength([1, 2], 3)).toThrow()
      })
    })

    describe('assertAllMatch', () => {
      it('should pass when all items match', () => {
        const items = [2, 4, 6, 8]

        expect(() =>
          assertAllMatch(items, (n) => n % 2 === 0, 'even number'),
        ).not.toThrow()
      })

      it('should throw when any item does not match', () => {
        const items = [2, 3, 4]

        expect(() =>
          assertAllMatch(items, (n) => n % 2 === 0, 'even number'),
        ).toThrow()
      })
    })
  })
})
