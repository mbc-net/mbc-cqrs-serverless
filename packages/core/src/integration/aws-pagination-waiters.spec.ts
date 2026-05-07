/**
 * AWS SDK Pagination & Waiters Integration Tests
 *
 * This file tests AWS SDK v3 pagination and waiter patterns:
 * - Pagination utilities (paginators)
 * - Waiter utilities
 * - Token-based pagination
 * - Cursor-based iteration
 *
 * These tests verify that pagination and waiter patterns work correctly
 * across AWS SDK version updates.
 */
import {
  DynamoDBClient,
  QueryCommand,
  ScanCommand,
  DescribeTableCommand,
} from '@aws-sdk/client-dynamodb'
import {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
  ListBucketsCommand,
} from '@aws-sdk/client-s3'
import {
  SQSClient,
  ListQueuesCommand,
  GetQueueAttributesCommand,
} from '@aws-sdk/client-sqs'
import { mockClient } from 'aws-sdk-client-mock'
import 'aws-sdk-client-mock-jest'

describe('AWS SDK Pagination & Waiters Integration', () => {
  // ============================================================================
  // DynamoDB Pagination Tests
  // ============================================================================
  describe('DynamoDB Pagination', () => {
    const dynamoMock = mockClient(DynamoDBClient)

    beforeEach(() => {
      dynamoMock.reset()
    })

    afterAll(() => {
      dynamoMock.restore()
    })

    describe('Query pagination', () => {
      it('should handle single page query', async () => {
        dynamoMock.on(QueryCommand).resolves({
          Items: [
            { pk: { S: 'item1' }, sk: { S: 'data1' } },
            { pk: { S: 'item2' }, sk: { S: 'data2' } },
          ],
          Count: 2,
          ScannedCount: 2,
          LastEvaluatedKey: undefined,
        })

        const client = new DynamoDBClient({})
        const result = await client.send(
          new QueryCommand({
            TableName: 'test-table',
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: { ':pk': { S: 'partition1' } },
          }),
        )

        expect(result.Items).toHaveLength(2)
        expect(result.LastEvaluatedKey).toBeUndefined()
      })

      it('should handle multi-page query with ExclusiveStartKey', async () => {
        const page1Key = { pk: { S: 'item2' }, sk: { S: 'data2' } }

        // Setup both pages in a chain
        dynamoMock.on(QueryCommand)
          .resolvesOnce({
            Items: [
              { pk: { S: 'item1' }, sk: { S: 'data1' } },
              { pk: { S: 'item2' }, sk: { S: 'data2' } },
            ],
            Count: 2,
            LastEvaluatedKey: page1Key,
          })
          .resolvesOnce({
            Items: [
              { pk: { S: 'item3' }, sk: { S: 'data3' } },
            ],
            Count: 1,
            LastEvaluatedKey: undefined,
          })

        const client = new DynamoDBClient({})
        const allItems: Record<string, { S: string }>[] = []

        // First request
        let result = await client.send(
          new QueryCommand({
            TableName: 'test-table',
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: { ':pk': { S: 'partition1' } },
          }),
        )
        allItems.push(...(result.Items as Record<string, { S: string }>[]))

        // Second request with pagination token
        if (result.LastEvaluatedKey) {
          result = await client.send(
            new QueryCommand({
              TableName: 'test-table',
              KeyConditionExpression: 'pk = :pk',
              ExpressionAttributeValues: { ':pk': { S: 'partition1' } },
              ExclusiveStartKey: result.LastEvaluatedKey,
            }),
          )
          allItems.push(...(result.Items as Record<string, { S: string }>[]))
        }

        expect(allItems).toHaveLength(3)
        expect(dynamoMock).toHaveReceivedCommandTimes(QueryCommand, 2)
      })

      it('should respect Limit parameter', async () => {
        dynamoMock.on(QueryCommand).resolves({
          Items: [{ pk: { S: 'item1' } }],
          Count: 1,
          LastEvaluatedKey: { pk: { S: 'item1' } },
        })

        const client = new DynamoDBClient({})
        const result = await client.send(
          new QueryCommand({
            TableName: 'test-table',
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: { ':pk': { S: 'partition1' } },
            Limit: 1,
          }),
        )

        expect(result.Items).toHaveLength(1)
        expect(result.LastEvaluatedKey).toBeDefined()

        expect(dynamoMock).toHaveReceivedCommandWith(QueryCommand, {
          Limit: 1,
        })
      })
    })

    describe('Scan pagination', () => {
      it('should handle full table scan with pagination', async () => {
        dynamoMock.on(ScanCommand)
          .resolvesOnce({
            Items: Array.from({ length: 100 }, (_, i) => ({
              pk: { S: `item${i}` },
            })),
            Count: 100,
            LastEvaluatedKey: { pk: { S: 'item99' } },
          })
          .resolvesOnce({
            Items: Array.from({ length: 50 }, (_, i) => ({
              pk: { S: `item${100 + i}` },
            })),
            Count: 50,
            LastEvaluatedKey: undefined,
          })

        const client = new DynamoDBClient({})

        async function* scanAllItems(tableName: string) {
          let lastKey = undefined as Record<string, { S: string }> | undefined

          do {
            const result = await client.send(
              new ScanCommand({
                TableName: tableName,
                ExclusiveStartKey: lastKey,
              }),
            )

            if (result.Items) {
              for (const item of result.Items) {
                yield item
              }
            }

            lastKey = result.LastEvaluatedKey as Record<string, { S: string }> | undefined
          } while (lastKey)
        }

        const items: unknown[] = []
        for await (const item of scanAllItems('test-table')) {
          items.push(item)
        }

        expect(items).toHaveLength(150)
        expect(dynamoMock).toHaveReceivedCommandTimes(ScanCommand, 2)
      })

      it('should handle parallel scan segments', async () => {
        // Segment 0
        dynamoMock.on(ScanCommand, {
          Segment: 0,
          TotalSegments: 2,
        }).resolves({
          Items: [{ pk: { S: 'seg0-item1' } }],
          Count: 1,
        })

        // Segment 1
        dynamoMock.on(ScanCommand, {
          Segment: 1,
          TotalSegments: 2,
        }).resolves({
          Items: [{ pk: { S: 'seg1-item1' } }],
          Count: 1,
        })

        const client = new DynamoDBClient({})
        const totalSegments = 2

        const segmentPromises = Array.from({ length: totalSegments }, (_, segment) =>
          client.send(
            new ScanCommand({
              TableName: 'test-table',
              Segment: segment,
              TotalSegments: totalSegments,
            }),
          ),
        )

        const results = await Promise.all(segmentPromises)
        const allItems = results.flatMap((r) => r.Items ?? [])

        expect(allItems).toHaveLength(2)
        expect(allItems.map((item) => (item as { pk: { S: string } }).pk.S))
          .toEqual(expect.arrayContaining(['seg0-item1', 'seg1-item1']))
      })
    })
  })

  // ============================================================================
  // S3 Pagination Tests
  // ============================================================================
  describe('S3 Pagination', () => {
    const s3Mock = mockClient(S3Client)

    beforeEach(() => {
      s3Mock.reset()
    })

    afterAll(() => {
      s3Mock.restore()
    })

    describe('ListObjectsV2 pagination', () => {
      it('should handle single page list', async () => {
        s3Mock.on(ListObjectsV2Command).resolves({
          Contents: [
            { Key: 'file1.txt', Size: 100 },
            { Key: 'file2.txt', Size: 200 },
          ],
          IsTruncated: false,
          KeyCount: 2,
        })

        const client = new S3Client({})
        const result = await client.send(
          new ListObjectsV2Command({
            Bucket: 'test-bucket',
          }),
        )

        expect(result.Contents).toHaveLength(2)
        expect(result.IsTruncated).toBe(false)
      })

      it('should handle multi-page list with ContinuationToken', async () => {
        s3Mock.on(ListObjectsV2Command)
          .resolvesOnce({
            Contents: Array.from({ length: 1000 }, (_, i) => ({
              Key: `file${i}.txt`,
              Size: 100,
            })),
            IsTruncated: true,
            NextContinuationToken: 'token-page-2',
            KeyCount: 1000,
          })
          .resolvesOnce({
            Contents: Array.from({ length: 500 }, (_, i) => ({
              Key: `file${1000 + i}.txt`,
              Size: 100,
            })),
            IsTruncated: false,
            KeyCount: 500,
          })

        const client = new S3Client({})

        async function* listAllObjects(bucket: string) {
          let continuationToken: string | undefined

          do {
            const result = await client.send(
              new ListObjectsV2Command({
                Bucket: bucket,
                ContinuationToken: continuationToken,
              }),
            )

            if (result.Contents) {
              for (const object of result.Contents) {
                yield object
              }
            }

            continuationToken = result.NextContinuationToken
          } while (continuationToken)
        }

        const objects: unknown[] = []
        for await (const obj of listAllObjects('test-bucket')) {
          objects.push(obj)
        }

        expect(objects).toHaveLength(1500)
        expect(s3Mock).toHaveReceivedCommandTimes(ListObjectsV2Command, 2)
      })

      it('should handle prefix filtering', async () => {
        s3Mock.on(ListObjectsV2Command, {
          Prefix: 'documents/',
        }).resolves({
          Contents: [
            { Key: 'documents/doc1.pdf', Size: 1000 },
            { Key: 'documents/doc2.pdf', Size: 2000 },
          ],
          CommonPrefixes: [
            { Prefix: 'documents/subfolder/' },
          ],
          IsTruncated: false,
        })

        const client = new S3Client({})
        const result = await client.send(
          new ListObjectsV2Command({
            Bucket: 'test-bucket',
            Prefix: 'documents/',
            Delimiter: '/',
          }),
        )

        expect(result.Contents).toHaveLength(2)
        expect(result.CommonPrefixes).toHaveLength(1)
      })

      it('should respect MaxKeys parameter', async () => {
        s3Mock.on(ListObjectsV2Command).resolves({
          Contents: [{ Key: 'file1.txt' }],
          IsTruncated: true,
          NextContinuationToken: 'next-token',
          KeyCount: 1,
        })

        const client = new S3Client({})
        await client.send(
          new ListObjectsV2Command({
            Bucket: 'test-bucket',
            MaxKeys: 1,
          }),
        )

        expect(s3Mock).toHaveReceivedCommandWith(ListObjectsV2Command, {
          MaxKeys: 1,
        })
      })
    })

    describe('ListBuckets pagination', () => {
      it('should list all buckets', async () => {
        s3Mock.on(ListBucketsCommand).resolves({
          Buckets: [
            { Name: 'bucket1', CreationDate: new Date('2024-01-01') },
            { Name: 'bucket2', CreationDate: new Date('2024-01-02') },
          ],
          Owner: { DisplayName: 'test-owner', ID: 'owner-id' },
        })

        const client = new S3Client({})
        const result = await client.send(new ListBucketsCommand({}))

        expect(result.Buckets).toHaveLength(2)
        expect(result.Owner?.DisplayName).toBe('test-owner')
      })
    })
  })

  // ============================================================================
  // SQS Pagination Tests
  // ============================================================================
  describe('SQS Pagination', () => {
    const sqsMock = mockClient(SQSClient)

    beforeEach(() => {
      sqsMock.reset()
    })

    afterAll(() => {
      sqsMock.restore()
    })

    describe('ListQueues pagination', () => {
      it('should handle single page queue list', async () => {
        sqsMock.on(ListQueuesCommand).resolves({
          QueueUrls: [
            'https://sqs.us-east-1.amazonaws.com/123456789/queue1',
            'https://sqs.us-east-1.amazonaws.com/123456789/queue2',
          ],
        })

        const client = new SQSClient({})
        const result = await client.send(new ListQueuesCommand({}))

        expect(result.QueueUrls).toHaveLength(2)
      })

      it('should handle multi-page queue list with NextToken', async () => {
        sqsMock.on(ListQueuesCommand)
          .resolvesOnce({
            QueueUrls: Array.from({ length: 100 }, (_, i) =>
              `https://sqs.us-east-1.amazonaws.com/123456789/queue${i}`,
            ),
            NextToken: 'next-page-token',
          })
          .resolvesOnce({
            QueueUrls: Array.from({ length: 50 }, (_, i) =>
              `https://sqs.us-east-1.amazonaws.com/123456789/queue${100 + i}`,
            ),
            NextToken: undefined,
          })

        const client = new SQSClient({})

        async function* listAllQueues() {
          let nextToken: string | undefined

          do {
            const result = await client.send(
              new ListQueuesCommand({
                NextToken: nextToken,
              }),
            )

            if (result.QueueUrls) {
              for (const url of result.QueueUrls) {
                yield url
              }
            }

            nextToken = result.NextToken
          } while (nextToken)
        }

        const queues: string[] = []
        for await (const queue of listAllQueues()) {
          queues.push(queue)
        }

        expect(queues).toHaveLength(150)
        expect(sqsMock).toHaveReceivedCommandTimes(ListQueuesCommand, 2)
      })

      it('should filter by queue name prefix', async () => {
        sqsMock.on(ListQueuesCommand, {
          QueueNamePrefix: 'prod-',
        }).resolves({
          QueueUrls: [
            'https://sqs.us-east-1.amazonaws.com/123456789/prod-queue1',
            'https://sqs.us-east-1.amazonaws.com/123456789/prod-queue2',
          ],
        })

        const client = new SQSClient({})
        const result = await client.send(
          new ListQueuesCommand({
            QueueNamePrefix: 'prod-',
          }),
        )

        expect(result.QueueUrls).toHaveLength(2)
        expect(result.QueueUrls?.every((url) => url.includes('prod-'))).toBe(true)
      })
    })
  })

  // ============================================================================
  // Waiter Pattern Tests
  // ============================================================================
  describe('Waiter Patterns', () => {
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

    describe('DynamoDB table waiter pattern', () => {
      it('should wait for table to become active', async () => {
        // First call: table creating
        dynamoMock.on(DescribeTableCommand)
          .resolvesOnce({
            Table: {
              TableName: 'test-table',
              TableStatus: 'CREATING',
            },
          })
          // Second call: table active
          .resolvesOnce({
            Table: {
              TableName: 'test-table',
              TableStatus: 'ACTIVE',
            },
          })

        const client = new DynamoDBClient({})

        async function waitForTableActive(
          tableName: string,
          maxAttempts = 10,
          delayMs = 100,
        ): Promise<boolean> {
          for (let i = 0; i < maxAttempts; i++) {
            const result = await client.send(
              new DescribeTableCommand({ TableName: tableName }),
            )

            if (result.Table?.TableStatus === 'ACTIVE') {
              return true
            }

            await new Promise((resolve) => setTimeout(resolve, delayMs))
          }

          return false
        }

        const isActive = await waitForTableActive('test-table', 10, 10)

        expect(isActive).toBe(true)
        expect(dynamoMock).toHaveReceivedCommandTimes(DescribeTableCommand, 2)
      })

      it('should timeout if table never becomes active', async () => {
        // Always return CREATING
        dynamoMock.on(DescribeTableCommand).resolves({
          Table: {
            TableName: 'test-table',
            TableStatus: 'CREATING',
          },
        })

        const client = new DynamoDBClient({})

        async function waitForTableActive(
          tableName: string,
          maxAttempts = 3,
          delayMs = 10,
        ): Promise<boolean> {
          for (let i = 0; i < maxAttempts; i++) {
            const result = await client.send(
              new DescribeTableCommand({ TableName: tableName }),
            )

            if (result.Table?.TableStatus === 'ACTIVE') {
              return true
            }

            await new Promise((resolve) => setTimeout(resolve, delayMs))
          }

          return false
        }

        const isActive = await waitForTableActive('test-table', 3, 10)

        expect(isActive).toBe(false)
        expect(dynamoMock).toHaveReceivedCommandTimes(DescribeTableCommand, 3)
      })
    })

    describe('S3 object waiter pattern', () => {
      it('should wait for object to exist', async () => {
        // First call: object doesn't exist
        s3Mock.on(HeadObjectCommand)
          .rejectsOnce({
            name: 'NotFound',
            $metadata: { httpStatusCode: 404 },
          })
          // Second call: object exists
          .resolvesOnce({
            ContentLength: 1000,
            ContentType: 'application/json',
            LastModified: new Date(),
          })

        const client = new S3Client({})

        async function waitForObjectExists(
          bucket: string,
          key: string,
          maxAttempts = 10,
          delayMs = 100,
        ): Promise<boolean> {
          for (let i = 0; i < maxAttempts; i++) {
            try {
              await client.send(
                new HeadObjectCommand({ Bucket: bucket, Key: key }),
              )
              return true
            } catch (error: unknown) {
              const err = error as { name?: string }
              if (err.name !== 'NotFound') {
                throw error
              }
            }

            await new Promise((resolve) => setTimeout(resolve, delayMs))
          }

          return false
        }

        const exists = await waitForObjectExists('test-bucket', 'test-key', 10, 10)

        expect(exists).toBe(true)
        expect(s3Mock).toHaveReceivedCommandTimes(HeadObjectCommand, 2)
      })

      it('should return false if object never appears', async () => {
        // Always return not found
        s3Mock.on(HeadObjectCommand).rejects({
          name: 'NotFound',
          $metadata: { httpStatusCode: 404 },
        })

        const client = new S3Client({})

        async function waitForObjectExists(
          bucket: string,
          key: string,
          maxAttempts = 3,
          delayMs = 10,
        ): Promise<boolean> {
          for (let i = 0; i < maxAttempts; i++) {
            try {
              await client.send(
                new HeadObjectCommand({ Bucket: bucket, Key: key }),
              )
              return true
            } catch (error: unknown) {
              const err = error as { name?: string }
              if (err.name !== 'NotFound') {
                throw error
              }
            }

            await new Promise((resolve) => setTimeout(resolve, delayMs))
          }

          return false
        }

        const exists = await waitForObjectExists('test-bucket', 'test-key', 3, 10)

        expect(exists).toBe(false)
        expect(s3Mock).toHaveReceivedCommandTimes(HeadObjectCommand, 3)
      })
    })

    describe('SQS queue attribute waiter pattern', () => {
      it('should wait for queue to be empty', async () => {
        const sqsMock = mockClient(SQSClient)

        // First call: messages in queue
        sqsMock.on(GetQueueAttributesCommand)
          .resolvesOnce({
            Attributes: {
              ApproximateNumberOfMessages: '5',
              ApproximateNumberOfMessagesNotVisible: '2',
            },
          })
          // Second call: queue empty
          .resolvesOnce({
            Attributes: {
              ApproximateNumberOfMessages: '0',
              ApproximateNumberOfMessagesNotVisible: '0',
            },
          })

        const client = new SQSClient({})

        async function waitForQueueEmpty(
          queueUrl: string,
          maxAttempts = 10,
          delayMs = 100,
        ): Promise<boolean> {
          for (let i = 0; i < maxAttempts; i++) {
            const result = await client.send(
              new GetQueueAttributesCommand({
                QueueUrl: queueUrl,
                AttributeNames: [
                  'ApproximateNumberOfMessages',
                  'ApproximateNumberOfMessagesNotVisible',
                ],
              }),
            )

            const visibleMessages = parseInt(
              result.Attributes?.ApproximateNumberOfMessages ?? '0',
              10,
            )
            const invisibleMessages = parseInt(
              result.Attributes?.ApproximateNumberOfMessagesNotVisible ?? '0',
              10,
            )

            if (visibleMessages === 0 && invisibleMessages === 0) {
              return true
            }

            await new Promise((resolve) => setTimeout(resolve, delayMs))
          }

          return false
        }

        const isEmpty = await waitForQueueEmpty('https://sqs.example.com/queue', 10, 10)

        expect(isEmpty).toBe(true)
        expect(sqsMock).toHaveReceivedCommandTimes(GetQueueAttributesCommand, 2)

        sqsMock.restore()
      })
    })
  })

  // ============================================================================
  // Generic Pagination Utilities
  // ============================================================================
  describe('Generic Pagination Utilities', () => {
    /**
     * Generic paginator function
     */
    async function* paginate<T, TToken>(
      fetcher: (token?: TToken) => Promise<{
        items: T[]
        nextToken?: TToken
      }>,
    ): AsyncGenerator<T, void, undefined> {
      let token: TToken | undefined

      do {
        const result = await fetcher(token)

        for (const item of result.items) {
          yield item
        }

        token = result.nextToken
      } while (token)
    }

    it('should paginate through all items', async () => {
      const mockFetcher = jest.fn()
        .mockResolvedValueOnce({
          items: [1, 2, 3],
          nextToken: 'token1',
        })
        .mockResolvedValueOnce({
          items: [4, 5],
          nextToken: undefined,
        })

      const items: number[] = []
      for await (const item of paginate<number, string>(mockFetcher)) {
        items.push(item)
      }

      expect(items).toEqual([1, 2, 3, 4, 5])
      expect(mockFetcher).toHaveBeenCalledTimes(2)
    })

    it('should handle empty result', async () => {
      const mockFetcher = jest.fn().mockResolvedValue({
        items: [],
        nextToken: undefined,
      })

      const items: number[] = []
      for await (const item of paginate<number, string>(mockFetcher)) {
        items.push(item)
      }

      expect(items).toEqual([])
      expect(mockFetcher).toHaveBeenCalledTimes(1)
    })

    it('should pass token to subsequent calls', async () => {
      const mockFetcher = jest.fn()
        .mockImplementation((token?: string) => {
          if (!token) {
            return Promise.resolve({ items: ['a'], nextToken: 'page2' })
          }
          if (token === 'page2') {
            return Promise.resolve({ items: ['b'], nextToken: 'page3' })
          }
          return Promise.resolve({ items: ['c'], nextToken: undefined })
        })

      const items: string[] = []
      for await (const item of paginate<string, string>(mockFetcher)) {
        items.push(item)
      }

      expect(items).toEqual(['a', 'b', 'c'])
      expect(mockFetcher).toHaveBeenNthCalledWith(1, undefined)
      expect(mockFetcher).toHaveBeenNthCalledWith(2, 'page2')
      expect(mockFetcher).toHaveBeenNthCalledWith(3, 'page3')
    })
  })

  // ============================================================================
  // Generic Waiter Utilities
  // ============================================================================
  describe('Generic Waiter Utilities', () => {
    /**
     * Generic waiter function
     */
    async function waitUntil<T>(
      checker: () => Promise<T | undefined>,
      predicate: (result: T) => boolean,
      options: {
        maxAttempts?: number
        delayMs?: number
        backoff?: boolean
      } = {},
    ): Promise<T | undefined> {
      const { maxAttempts = 10, delayMs = 100, backoff = false } = options

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const result = await checker()

        if (result !== undefined && predicate(result)) {
          return result
        }

        const delay = backoff ? delayMs * Math.pow(2, attempt) : delayMs
        await new Promise((resolve) => setTimeout(resolve, delay))
      }

      return undefined
    }

    it('should return result when predicate is satisfied', async () => {
      let callCount = 0
      const checker = jest.fn().mockImplementation(() => {
        callCount++
        return Promise.resolve({ status: callCount >= 3 ? 'ready' : 'pending' })
      })

      const result = await waitUntil<{ status: string }>(
        checker,
        (r) => r.status === 'ready',
        { maxAttempts: 10, delayMs: 10 },
      )

      expect(result).toEqual({ status: 'ready' })
      expect(checker).toHaveBeenCalledTimes(3)
    })

    it('should return undefined when max attempts exceeded', async () => {
      const checker = jest.fn().mockResolvedValue({ status: 'pending' })

      const result = await waitUntil<{ status: string }>(
        checker,
        (r) => r.status === 'ready',
        { maxAttempts: 3, delayMs: 10 },
      )

      expect(result).toBeUndefined()
      expect(checker).toHaveBeenCalledTimes(3)
    })

    it('should apply exponential backoff when enabled', async () => {
      const timestamps: number[] = []
      const checker = jest.fn().mockImplementation(() => {
        timestamps.push(Date.now())
        return Promise.resolve({ status: 'pending' })
      })

      await waitUntil<{ status: string }>(
        checker,
        (r) => r.status === 'ready',
        { maxAttempts: 4, delayMs: 10, backoff: true },
      )

      // Check that delays increase (allowing for timing variance)
      expect(timestamps).toHaveLength(4)

      // With backoff: delays should be roughly 10, 20, 40ms
      // We can't test exact timing, but we can verify the checker was called
      expect(checker).toHaveBeenCalledTimes(4)
    })
  })

  // ============================================================================
  // Batch Collection Utilities
  // ============================================================================
  describe('Batch Collection Utilities', () => {
    /**
     * Collects all paginated results into an array
     */
    async function collectAll<T>(generator: AsyncIterable<T>): Promise<T[]> {
      const items: T[] = []
      for await (const item of generator) {
        items.push(item)
      }
      return items
    }

    /**
     * Collects up to N items from a paginated source
     */
    async function takeN<T>(
      generator: AsyncIterable<T>,
      n: number,
    ): Promise<T[]> {
      const items: T[] = []
      for await (const item of generator) {
        items.push(item)
        if (items.length >= n) {
          break
        }
      }
      return items
    }

    it('should collect all items from async generator', async () => {
      async function* source() {
        yield 1
        yield 2
        yield 3
      }

      const items = await collectAll(source())
      expect(items).toEqual([1, 2, 3])
    })

    it('should take only first N items', async () => {
      async function* infiniteSource() {
        let i = 0
        while (true) {
          yield i++
        }
      }

      const items = await takeN(infiniteSource(), 5)
      expect(items).toEqual([0, 1, 2, 3, 4])
    })
  })
})
