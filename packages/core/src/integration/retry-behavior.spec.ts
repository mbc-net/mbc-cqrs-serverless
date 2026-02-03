/**
 * AWS SDK v3 Retry Behavior Tests
 *
 * This file tests the AWS SDK v3 retry mechanism contracts:
 * - Retry configuration API
 * - Error classification (retriable vs non-retriable)
 * - Throttling error detection
 * - Client configuration options
 *
 * Note: aws-sdk-client-mock bypasses the actual SDK retry mechanism,
 * so we test API contracts and error classification rather than
 * actual retry behavior.
 */
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { marshall } from '@aws-sdk/util-dynamodb'
import { mockClient } from 'aws-sdk-client-mock'
import 'aws-sdk-client-mock-jest'

describe('AWS SDK v3 Retry Behavior', () => {
  // ============================================================================
  // Retry Configuration API
  // ============================================================================
  describe('Retry Configuration API', () => {
    describe('Client configuration options', () => {
      it('should accept maxAttempts configuration', () => {
        const client = new DynamoDBClient({
          region: 'ap-northeast-1',
          maxAttempts: 5,
        })

        expect(client.config).toBeDefined()
        client.destroy()
      })

      it('should accept retryMode configuration (standard)', () => {
        const client = new DynamoDBClient({
          region: 'ap-northeast-1',
          retryMode: 'standard',
        })

        expect(client.config).toBeDefined()
        client.destroy()
      })

      it('should accept retryMode configuration (adaptive)', () => {
        const client = new DynamoDBClient({
          region: 'ap-northeast-1',
          retryMode: 'adaptive',
        })

        expect(client.config).toBeDefined()
        client.destroy()
      })

      it('should accept maxAttempts of 1 (no retries)', () => {
        const client = new DynamoDBClient({
          region: 'ap-northeast-1',
          maxAttempts: 1,
        })

        expect(client.config).toBeDefined()
        client.destroy()
      })

      it('should support S3 client with retry configuration', () => {
        const client = new S3Client({
          region: 'ap-northeast-1',
          maxAttempts: 3,
          retryMode: 'standard',
        })

        expect(client.config).toBeDefined()
        client.destroy()
      })
    })
  })

  // ============================================================================
  // Non-Retriable Error Behavior (Mock tests)
  // ============================================================================
  describe('Non-Retriable Error Behavior', () => {
    const dynamoMock = mockClient(DynamoDBClient)
    const s3Mock = mockClient(S3Client)

    beforeEach(() => {
      dynamoMock.reset()
      s3Mock.reset()
    })

    afterAll(() => {
      dynamoMock.restore()
      s3Mock.restore()
    })

    describe('DynamoDB non-retriable errors', () => {
      it('should propagate ValidationException', async () => {
        const client = new DynamoDBClient({ region: 'ap-northeast-1' })
        let attempts = 0

        dynamoMock.on(GetItemCommand).callsFake(() => {
          attempts++
          const error = new Error('Validation error') as Error & {
            name: string
            $metadata: { httpStatusCode: number }
          }
          error.name = 'ValidationException'
          error.$metadata = { httpStatusCode: 400 }
          throw error
        })

        await expect(
          client.send(
            new GetItemCommand({
              TableName: 'test-table',
              Key: marshall({ pk: 'pk', sk: 'sk' }),
            }),
          ),
        ).rejects.toThrow('Validation error')

        // Mock bypasses retry, so only 1 attempt
        expect(attempts).toBe(1)
        client.destroy()
      })

      it('should propagate ResourceNotFoundException', async () => {
        const client = new DynamoDBClient({ region: 'ap-northeast-1' })
        let attempts = 0

        dynamoMock.on(GetItemCommand).callsFake(() => {
          attempts++
          const error = new Error('Table not found') as Error & {
            name: string
            $metadata: { httpStatusCode: number }
          }
          error.name = 'ResourceNotFoundException'
          error.$metadata = { httpStatusCode: 400 }
          throw error
        })

        await expect(
          client.send(
            new GetItemCommand({
              TableName: 'non-existent-table',
              Key: marshall({ pk: 'pk', sk: 'sk' }),
            }),
          ),
        ).rejects.toThrow('Table not found')

        expect(attempts).toBe(1)
        client.destroy()
      })

      it('should propagate ConditionalCheckFailedException', async () => {
        const client = new DynamoDBClient({ region: 'ap-northeast-1' })
        let attempts = 0

        dynamoMock.on(PutItemCommand).callsFake(() => {
          attempts++
          const error = new Error('Condition check failed') as Error & {
            name: string
            $metadata: { httpStatusCode: number }
          }
          error.name = 'ConditionalCheckFailedException'
          error.$metadata = { httpStatusCode: 400 }
          throw error
        })

        await expect(
          client.send(
            new PutItemCommand({
              TableName: 'test-table',
              Item: marshall({ pk: 'pk', sk: 'sk' }),
              ConditionExpression: 'attribute_not_exists(pk)',
            }),
          ),
        ).rejects.toThrow('Condition check failed')

        expect(attempts).toBe(1)
        client.destroy()
      })

      it('should propagate AccessDeniedException', async () => {
        const client = new DynamoDBClient({ region: 'ap-northeast-1' })
        let attempts = 0

        dynamoMock.on(GetItemCommand).callsFake(() => {
          attempts++
          const error = new Error('Access denied') as Error & {
            name: string
            $metadata: { httpStatusCode: number }
          }
          error.name = 'AccessDeniedException'
          error.$metadata = { httpStatusCode: 403 }
          throw error
        })

        await expect(
          client.send(
            new GetItemCommand({
              TableName: 'restricted-table',
              Key: marshall({ pk: 'pk', sk: 'sk' }),
            }),
          ),
        ).rejects.toThrow('Access denied')

        expect(attempts).toBe(1)
        client.destroy()
      })
    })

    describe('S3 non-retriable errors', () => {
      it('should propagate NoSuchKey', async () => {
        const client = new S3Client({ region: 'ap-northeast-1' })
        let attempts = 0

        s3Mock.on(GetObjectCommand).callsFake(() => {
          attempts++
          const error = new Error('Key not found') as Error & {
            name: string
            $metadata: { httpStatusCode: number }
          }
          error.name = 'NoSuchKey'
          error.$metadata = { httpStatusCode: 404 }
          throw error
        })

        await expect(
          client.send(
            new GetObjectCommand({
              Bucket: 'test-bucket',
              Key: 'non-existent-key',
            }),
          ),
        ).rejects.toThrow('Key not found')

        expect(attempts).toBe(1)
        client.destroy()
      })

      it('should propagate NoSuchBucket', async () => {
        const client = new S3Client({ region: 'ap-northeast-1' })
        let attempts = 0

        s3Mock.on(GetObjectCommand).callsFake(() => {
          attempts++
          const error = new Error('Bucket not found') as Error & {
            name: string
            $metadata: { httpStatusCode: number }
          }
          error.name = 'NoSuchBucket'
          error.$metadata = { httpStatusCode: 404 }
          throw error
        })

        await expect(
          client.send(
            new GetObjectCommand({
              Bucket: 'non-existent-bucket',
              Key: 'test-key',
            }),
          ),
        ).rejects.toThrow('Bucket not found')

        expect(attempts).toBe(1)
        client.destroy()
      })

      it('should propagate AccessDenied', async () => {
        const client = new S3Client({ region: 'ap-northeast-1' })
        let attempts = 0

        s3Mock.on(GetObjectCommand).callsFake(() => {
          attempts++
          const error = new Error('Access denied') as Error & {
            name: string
            $metadata: { httpStatusCode: number }
          }
          error.name = 'AccessDenied'
          error.$metadata = { httpStatusCode: 403 }
          throw error
        })

        await expect(
          client.send(
            new GetObjectCommand({
              Bucket: 'restricted-bucket',
              Key: 'private-key',
            }),
          ),
        ).rejects.toThrow('Access denied')

        expect(attempts).toBe(1)
        client.destroy()
      })
    })
  })

  // ============================================================================
  // Error Classification
  // ============================================================================
  describe('Error Classification', () => {
    describe('Retriable error detection', () => {
      const isRetriableError = (
        error: Error & {
          $retryable?: { throttling?: boolean }
          $metadata?: { httpStatusCode?: number }
        },
      ): boolean => {
        // Check $retryable flag
        if (error.$retryable) {
          return true
        }

        // Check HTTP status codes
        const statusCode = error.$metadata?.httpStatusCode
        if (statusCode) {
          // 5xx errors are retriable
          if (statusCode >= 500 && statusCode < 600) {
            return true
          }
          // 429 Too Many Requests
          if (statusCode === 429) {
            return true
          }
        }

        // Check error names
        const retriableErrorNames = [
          'ProvisionedThroughputExceededException',
          'ThrottlingException',
          'InternalServerError',
          'ServiceUnavailable',
          'RequestLimitExceeded',
        ]

        if (retriableErrorNames.includes(error.name)) {
          return true
        }

        return false
      }

      it('should identify ProvisionedThroughputExceededException as retriable', () => {
        const error = new Error('Rate exceeded') as Error & {
          name: string
          $retryable: { throttling: boolean }
        }
        error.name = 'ProvisionedThroughputExceededException'
        error.$retryable = { throttling: true }

        expect(isRetriableError(error)).toBe(true)
      })

      it('should identify ThrottlingException as retriable', () => {
        const error = new Error('Throttled') as Error & {
          name: string
          $retryable: { throttling: boolean }
        }
        error.name = 'ThrottlingException'
        error.$retryable = { throttling: true }

        expect(isRetriableError(error)).toBe(true)
      })

      it('should identify InternalServerError as retriable', () => {
        const error = new Error('Server error') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'InternalServerError'
        error.$metadata = { httpStatusCode: 500 }

        expect(isRetriableError(error)).toBe(true)
      })

      it('should identify ServiceUnavailable as retriable', () => {
        const error = new Error('Service unavailable') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'ServiceUnavailable'
        error.$metadata = { httpStatusCode: 503 }

        expect(isRetriableError(error)).toBe(true)
      })

      it('should identify 500 error as retriable', () => {
        const error = new Error('Server error') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'SomeServerError'
        error.$metadata = { httpStatusCode: 500 }

        expect(isRetriableError(error)).toBe(true)
      })

      it('should identify 502 error as retriable', () => {
        const error = new Error('Bad gateway') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'BadGateway'
        error.$metadata = { httpStatusCode: 502 }

        expect(isRetriableError(error)).toBe(true)
      })

      it('should identify 503 error as retriable', () => {
        const error = new Error('Service unavailable') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'ServiceUnavailable'
        error.$metadata = { httpStatusCode: 503 }

        expect(isRetriableError(error)).toBe(true)
      })

      it('should identify 504 error as retriable', () => {
        const error = new Error('Gateway timeout') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'GatewayTimeout'
        error.$metadata = { httpStatusCode: 504 }

        expect(isRetriableError(error)).toBe(true)
      })

      it('should identify 429 error as retriable', () => {
        const error = new Error('Too many requests') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'TooManyRequestsException'
        error.$metadata = { httpStatusCode: 429 }

        expect(isRetriableError(error)).toBe(true)
      })

      it('should identify ValidationException as non-retriable', () => {
        const error = new Error('Validation error') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'ValidationException'
        error.$metadata = { httpStatusCode: 400 }

        expect(isRetriableError(error)).toBe(false)
      })

      it('should identify ResourceNotFoundException as non-retriable', () => {
        const error = new Error('Resource not found') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'ResourceNotFoundException'
        error.$metadata = { httpStatusCode: 400 }

        expect(isRetriableError(error)).toBe(false)
      })

      it('should identify AccessDeniedException as non-retriable', () => {
        const error = new Error('Access denied') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'AccessDeniedException'
        error.$metadata = { httpStatusCode: 403 }

        expect(isRetriableError(error)).toBe(false)
      })

      it('should identify ConditionalCheckFailedException as non-retriable', () => {
        const error = new Error('Condition failed') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'ConditionalCheckFailedException'
        error.$metadata = { httpStatusCode: 400 }

        expect(isRetriableError(error)).toBe(false)
      })

      it('should identify 400 error as non-retriable', () => {
        const error = new Error('Bad request') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'BadRequest'
        error.$metadata = { httpStatusCode: 400 }

        expect(isRetriableError(error)).toBe(false)
      })

      it('should identify 401 error as non-retriable', () => {
        const error = new Error('Unauthorized') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'Unauthorized'
        error.$metadata = { httpStatusCode: 401 }

        expect(isRetriableError(error)).toBe(false)
      })

      it('should identify 403 error as non-retriable', () => {
        const error = new Error('Forbidden') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'Forbidden'
        error.$metadata = { httpStatusCode: 403 }

        expect(isRetriableError(error)).toBe(false)
      })

      it('should identify 404 error as non-retriable', () => {
        const error = new Error('Not found') as Error & {
          name: string
          $metadata: { httpStatusCode: number }
        }
        error.name = 'NotFound'
        error.$metadata = { httpStatusCode: 404 }

        expect(isRetriableError(error)).toBe(false)
      })
    })

    describe('Throttling error detection', () => {
      const isThrottlingError = (
        error: Error & { $retryable?: { throttling?: boolean } },
      ): boolean => {
        return error.$retryable?.throttling === true
      }

      it('should detect throttling from $retryable flag', () => {
        const error = new Error('Throttled') as Error & {
          name: string
          $retryable: { throttling: boolean }
        }
        error.name = 'ProvisionedThroughputExceededException'
        error.$retryable = { throttling: true }

        expect(isThrottlingError(error)).toBe(true)
      })

      it('should detect ThrottlingException as throttling error', () => {
        const error = new Error('Request rate exceeded') as Error & {
          name: string
          $retryable: { throttling: boolean }
        }
        error.name = 'ThrottlingException'
        error.$retryable = { throttling: true }

        expect(isThrottlingError(error)).toBe(true)
      })

      it('should detect non-throttling retriable errors', () => {
        const error = new Error('Server error') as Error & {
          name: string
          $retryable: { throttling: boolean }
        }
        error.name = 'InternalServerError'
        error.$retryable = { throttling: false }

        expect(isThrottlingError(error)).toBe(false)
      })

      it('should handle errors without $retryable flag', () => {
        const error = new Error('Some error') as Error & {
          name: string
        }
        error.name = 'SomeError'

        expect(isThrottlingError(error)).toBe(false)
      })
    })
  })

  // ============================================================================
  // Network Error Classification
  // ============================================================================
  describe('Network Error Classification', () => {
    describe('Connection error detection', () => {
      const isNetworkError = (error: Error & { code?: string }): boolean => {
        const networkErrorCodes = [
          'ECONNRESET',
          'ECONNREFUSED',
          'ETIMEDOUT',
          'ENETUNREACH',
          'ENOTFOUND',
          'EPIPE',
          'EAI_AGAIN',
        ]

        if (error.code && networkErrorCodes.includes(error.code)) {
          return true
        }

        // Check for common network error messages
        const message = error.message.toLowerCase()
        if (
          message.includes('socket hang up') ||
          message.includes('network error') ||
          message.includes('connection reset') ||
          message.includes('connection refused')
        ) {
          return true
        }

        return false
      }

      it('should detect ECONNRESET as network error', () => {
        const error = new Error('read ECONNRESET') as Error & { code: string }
        error.code = 'ECONNRESET'

        expect(isNetworkError(error)).toBe(true)
      })

      it('should detect ECONNREFUSED as network error', () => {
        const error = new Error('connect ECONNREFUSED') as Error & {
          code: string
        }
        error.code = 'ECONNREFUSED'

        expect(isNetworkError(error)).toBe(true)
      })

      it('should detect ETIMEDOUT as network error', () => {
        const error = new Error('connect ETIMEDOUT') as Error & { code: string }
        error.code = 'ETIMEDOUT'

        expect(isNetworkError(error)).toBe(true)
      })

      it('should detect ENETUNREACH as network error', () => {
        const error = new Error('network unreachable') as Error & {
          code: string
        }
        error.code = 'ENETUNREACH'

        expect(isNetworkError(error)).toBe(true)
      })

      it('should detect ENOTFOUND as network error', () => {
        const error = new Error('getaddrinfo ENOTFOUND') as Error & {
          code: string
        }
        error.code = 'ENOTFOUND'

        expect(isNetworkError(error)).toBe(true)
      })

      it('should detect socket hang up as network error', () => {
        const error = new Error('socket hang up')

        expect(isNetworkError(error)).toBe(true)
      })

      it('should detect connection reset message as network error', () => {
        const error = new Error('Connection reset by peer')

        expect(isNetworkError(error)).toBe(true)
      })

      it('should not detect application errors as network errors', () => {
        const error = new Error('Validation failed')

        expect(isNetworkError(error)).toBe(false)
      })
    })

    describe('Timeout error detection', () => {
      const isTimeoutError = (
        error: Error & { code?: string; name?: string },
      ): boolean => {
        if (error.code === 'ETIMEDOUT') {
          return true
        }

        if (error.name === 'TimeoutError') {
          return true
        }

        const message = error.message.toLowerCase()
        if (
          message.includes('timeout') ||
          message.includes('timed out') ||
          message.includes('request timeout')
        ) {
          return true
        }

        return false
      }

      it('should detect ETIMEDOUT as timeout error', () => {
        const error = new Error('connect ETIMEDOUT') as Error & { code: string }
        error.code = 'ETIMEDOUT'

        expect(isTimeoutError(error)).toBe(true)
      })

      it('should detect TimeoutError name as timeout error', () => {
        const error = new Error('Request timed out') as Error & { name: string }
        error.name = 'TimeoutError'

        expect(isTimeoutError(error)).toBe(true)
      })

      it('should detect timeout in message', () => {
        const error = new Error('Connection timeout after 30s')

        expect(isTimeoutError(error)).toBe(true)
      })

      it('should detect request timeout in message', () => {
        const error = new Error('Request timeout exceeded')

        expect(isTimeoutError(error)).toBe(true)
      })

      it('should not detect non-timeout errors', () => {
        const error = new Error('Access denied')

        expect(isTimeoutError(error)).toBe(false)
      })
    })
  })

  // ============================================================================
  // Request Parameter Preservation
  // ============================================================================
  describe('Request Parameter Preservation', () => {
    const dynamoMock = mockClient(DynamoDBClient)

    beforeEach(() => {
      dynamoMock.reset()
    })

    afterAll(() => {
      dynamoMock.restore()
    })

    describe('Request consistency', () => {
      it('should preserve request parameters through mock', async () => {
        const client = new DynamoDBClient({ region: 'ap-northeast-1' })
        const receivedRequests: unknown[] = []

        dynamoMock.on(PutItemCommand).callsFake((input) => {
          receivedRequests.push(JSON.parse(JSON.stringify(input)))
          return {}
        })

        const itemData = { pk: 'test-pk', sk: 'test-sk', value: 123 }
        await client.send(
          new PutItemCommand({
            TableName: 'test-table',
            Item: marshall(itemData),
          }),
        )

        expect(receivedRequests.length).toBe(1)
        expect(receivedRequests[0]).toHaveProperty('TableName', 'test-table')
        expect(receivedRequests[0]).toHaveProperty('Item')
        client.destroy()
      })

      it('should preserve condition expressions', async () => {
        const client = new DynamoDBClient({ region: 'ap-northeast-1' })
        const receivedRequests: unknown[] = []

        dynamoMock.on(PutItemCommand).callsFake((input) => {
          receivedRequests.push(JSON.parse(JSON.stringify(input)))
          return {}
        })

        await client.send(
          new PutItemCommand({
            TableName: 'test-table',
            Item: marshall({ pk: 'pk', sk: 'sk' }),
            ConditionExpression: 'attribute_not_exists(pk)',
          }),
        )

        expect(receivedRequests.length).toBe(1)
        expect(receivedRequests[0]).toHaveProperty(
          'ConditionExpression',
          'attribute_not_exists(pk)',
        )
        client.destroy()
      })
    })
  })

  // ============================================================================
  // Error Metadata
  // ============================================================================
  describe('Error Metadata', () => {
    describe('AWS error structure', () => {
      it('should have standard error properties', () => {
        const error = new Error('Some AWS error') as Error & {
          name: string
          $metadata: { httpStatusCode: number; requestId: string }
          $fault: string
        }
        error.name = 'SomeAWSException'
        error.$metadata = {
          httpStatusCode: 400,
          requestId: 'abc-123-def',
        }
        error.$fault = 'client'

        expect(error.name).toBe('SomeAWSException')
        expect(error.$metadata.httpStatusCode).toBe(400)
        expect(error.$metadata.requestId).toBe('abc-123-def')
        expect(error.$fault).toBe('client')
      })

      it('should distinguish client vs server faults', () => {
        const clientError = new Error('Client error') as Error & {
          $fault: string
        }
        clientError.$fault = 'client'

        const serverError = new Error('Server error') as Error & {
          $fault: string
        }
        serverError.$fault = 'server'

        expect(clientError.$fault).toBe('client')
        expect(serverError.$fault).toBe('server')
      })
    })
  })
})
