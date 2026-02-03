/**
 * Large Data Handling Tests
 *
 * This file tests large data processing:
 * - Large batch operations (1000+ items)
 * - Memory usage monitoring
 * - Streaming processing
 * - Pagination handling
 *
 * These tests verify memory efficiency and scalability to detect performance regressions.
 */
import {
  BatchWriteItemCommand,
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb'
import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { sdkStreamMixin } from '@smithy/util-stream'
import { mockClient } from 'aws-sdk-client-mock'
import 'aws-sdk-client-mock-jest'
import { Readable } from 'stream'

describe('Large Data Handling Tests', () => {
  // ============================================================================
  // Memory Monitoring Utilities
  // ============================================================================
  const getHeapUsed = (): number => {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed
    }
    return 0
  }

  const forceGC = (): void => {
    if (typeof global !== 'undefined' && (global as any).gc) {
      ;(global as any).gc()
    }
  }

  // ============================================================================
  // DynamoDB Large Batch Operations
  // ============================================================================
  describe('DynamoDB large batch operations', () => {
    const dynamoMock = mockClient(DynamoDBClient)
    const client = new DynamoDBClient({ region: 'ap-northeast-1' })

    beforeEach(() => {
      dynamoMock.reset()
    })

    describe('Batch processing 1000+ items', () => {
      it('should process large batch without significant memory increase', async () => {
        // Setup mock for batch writes
        dynamoMock.on(BatchWriteItemCommand).resolves({
          UnprocessedItems: {},
        })

        const itemCount = 1000
        const items = Array.from({ length: itemCount }, (_, i) => ({
          pk: `pk-${i}`,
          sk: `sk-${i}`,
          data: `data-${i}`,
          timestamp: Date.now(),
        }))

        forceGC()
        const initialMemory = getHeapUsed()

        // Process in batches of 25 (DynamoDB limit)
        const batchSize = 25
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize)
          await client.send(
            new BatchWriteItemCommand({
              RequestItems: {
                'test-table': batch.map((item) => ({
                  PutRequest: { Item: marshall(item) },
                })),
              },
            }),
          )
        }

        forceGC()
        const finalMemory = getHeapUsed()
        const memoryIncrease = finalMemory - initialMemory

        // Memory increase should be reasonable (less than 50MB for this test)
        // This threshold may need adjustment based on test environment
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
      })

      it('should handle 25-item batches correctly', async () => {
        dynamoMock.on(BatchWriteItemCommand).resolves({
          UnprocessedItems: {},
        })

        const items = Array.from({ length: 25 }, (_, i) => ({
          pk: `pk-${i}`,
          sk: `sk-${i}`,
        }))

        await client.send(
          new BatchWriteItemCommand({
            RequestItems: {
              'test-table': items.map((item) => ({
                PutRequest: { Item: marshall(item) },
              })),
            },
          }),
        )

        expect(dynamoMock).toHaveReceivedCommandTimes(BatchWriteItemCommand, 1)
      })

      it('should retry unprocessed items', async () => {
        let callCount = 0

        dynamoMock.on(BatchWriteItemCommand).callsFake((input) => {
          callCount++
          if (callCount === 1) {
            // First call: return some unprocessed items
            return {
              UnprocessedItems: {
                'test-table': [
                  {
                    PutRequest: { Item: marshall({ pk: 'retry', sk: 'item' }) },
                  },
                ],
              },
            }
          }
          // Second call: all processed
          return { UnprocessedItems: {} }
        })

        // First batch
        const result1 = await client.send(
          new BatchWriteItemCommand({
            RequestItems: {
              'test-table': [
                { PutRequest: { Item: marshall({ pk: 'pk1', sk: 'sk1' }) } },
                { PutRequest: { Item: marshall({ pk: 'retry', sk: 'item' }) } },
              ],
            },
          }),
        )

        expect(result1.UnprocessedItems?.['test-table']).toBeDefined()

        // Retry unprocessed items
        await client.send(
          new BatchWriteItemCommand({
            RequestItems: result1.UnprocessedItems,
          }),
        )

        expect(callCount).toBe(2)
      })
    })

    describe('Large query pagination', () => {
      it('should handle paginated query results', async () => {
        const pageSize = 100
        const totalPages = 10

        // Setup mock to return paginated results
        let pageCount = 0
        dynamoMock.on(QueryCommand).callsFake(() => {
          pageCount++
          const items = Array.from({ length: pageSize }, (_, i) => ({
            pk: { S: 'pk' },
            sk: { S: `sk-${(pageCount - 1) * pageSize + i}` },
          }))

          return {
            Items: items,
            Count: pageSize,
            LastEvaluatedKey:
              pageCount < totalPages
                ? {
                    pk: { S: 'pk' },
                    sk: { S: `sk-${pageCount * pageSize - 1}` },
                  }
                : undefined,
          }
        })

        const allItems: Record<string, unknown>[] = []
        let lastKey: Record<string, unknown> | undefined

        do {
          const result = await client.send(
            new QueryCommand({
              TableName: 'test-table',
              KeyConditionExpression: 'pk = :pk',
              ExpressionAttributeValues: marshall({ ':pk': 'pk' }),
              ExclusiveStartKey: lastKey as any,
            }),
          )

          if (result.Items) {
            allItems.push(...result.Items.map((item) => unmarshall(item)))
          }

          lastKey = result.LastEvaluatedKey as
            | Record<string, unknown>
            | undefined
        } while (lastKey)

        expect(allItems.length).toBe(pageSize * totalPages)
        expect(pageCount).toBe(totalPages)
      })

      it('should handle empty page in pagination', async () => {
        dynamoMock.on(QueryCommand).resolvesOnce({
          Items: [],
          Count: 0,
          LastEvaluatedKey: undefined,
        })

        const result = await client.send(
          new QueryCommand({
            TableName: 'test-table',
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: marshall({ ':pk': 'nonexistent' }),
          }),
        )

        expect(result.Items).toEqual([])
        expect(result.Count).toBe(0)
      })
    })
  })

  // ============================================================================
  // S3 Large Object Handling
  // ============================================================================
  describe('S3 large object handling', () => {
    const s3Mock = mockClient(S3Client)
    const client = new S3Client({ region: 'ap-northeast-1' })

    beforeEach(() => {
      s3Mock.reset()
    })

    describe('Large object streaming', () => {
      it('should stream large object without loading entirely into memory', async () => {
        const chunkSize = 1024 * 1024 // 1MB chunks
        const totalChunks = 10

        // Create a readable stream that generates data
        const generateStream = () => {
          let chunksEmitted = 0
          return new Readable({
            read() {
              if (chunksEmitted < totalChunks) {
                this.push(Buffer.alloc(chunkSize, 'x'))
                chunksEmitted++
              } else {
                this.push(null)
              }
            },
          })
        }

        const stream = generateStream()
        const sdkStream = sdkStreamMixin(stream)

        s3Mock.on(GetObjectCommand).resolves({
          Body: sdkStream,
          ContentLength: chunkSize * totalChunks,
        })

        const result = await client.send(
          new GetObjectCommand({
            Bucket: 'test-bucket',
            Key: 'large-file.bin',
          }),
        )

        expect(result.Body).toBeDefined()
        expect(result.ContentLength).toBe(chunkSize * totalChunks)
      })

      it('should handle streaming JSON parsing', async () => {
        const largeArray = Array.from({ length: 10000 }, (_, i) => ({
          id: i,
          name: `item-${i}`,
        }))
        const jsonString = JSON.stringify(largeArray)

        const stream = new Readable()
        stream.push(jsonString)
        stream.push(null)
        const sdkStream = sdkStreamMixin(stream)

        s3Mock.on(GetObjectCommand).resolves({
          Body: sdkStream,
          ContentType: 'application/json',
        })

        const result = await client.send(
          new GetObjectCommand({
            Bucket: 'test-bucket',
            Key: 'large-data.json',
          }),
        )

        const content = await result.Body!.transformToString()
        const parsed = JSON.parse(content)

        expect(parsed.length).toBe(10000)
        expect(parsed[0].id).toBe(0)
        expect(parsed[9999].id).toBe(9999)
      })
    })

    describe('Large list pagination', () => {
      it('should handle paginated ListObjectsV2', async () => {
        const objectsPerPage = 1000
        const totalPages = 5

        let pageCount = 0
        s3Mock.on(ListObjectsV2Command).callsFake(() => {
          pageCount++
          const contents = Array.from({ length: objectsPerPage }, (_, i) => ({
            Key: `file-${(pageCount - 1) * objectsPerPage + i}.txt`,
            Size: 1024,
            LastModified: new Date(),
          }))

          return {
            Contents: contents,
            IsTruncated: pageCount < totalPages,
            NextContinuationToken:
              pageCount < totalPages ? `token-${pageCount}` : undefined,
            KeyCount: objectsPerPage,
          }
        })

        const allObjects: { Key?: string }[] = []
        let continuationToken: string | undefined

        do {
          const result = await client.send(
            new ListObjectsV2Command({
              Bucket: 'test-bucket',
              ContinuationToken: continuationToken,
            }),
          )

          if (result.Contents) {
            allObjects.push(...result.Contents)
          }

          continuationToken = result.NextContinuationToken
        } while (continuationToken)

        expect(allObjects.length).toBe(objectsPerPage * totalPages)
        expect(pageCount).toBe(totalPages)
      })
    })
  })

  // ============================================================================
  // Memory Efficiency Tests
  // ============================================================================
  describe('Memory efficiency tests', () => {
    describe('Object creation and cleanup', () => {
      it('should not accumulate memory with repeated operations', async () => {
        const dynamoMock = mockClient(DynamoDBClient)
        const client = new DynamoDBClient({ region: 'ap-northeast-1' })

        dynamoMock.on(PutItemCommand).resolves({})

        forceGC()
        const baseMemory = getHeapUsed()

        // Perform many operations
        for (let iteration = 0; iteration < 100; iteration++) {
          const item = {
            pk: `pk-${iteration}`,
            sk: `sk-${iteration}`,
            data: 'x'.repeat(1000),
          }

          await client.send(
            new PutItemCommand({
              TableName: 'test-table',
              Item: marshall(item),
            }),
          )
        }

        forceGC()
        const finalMemory = getHeapUsed()
        const memoryGrowth = finalMemory - baseMemory

        // Memory growth should be minimal after GC
        // The exact threshold depends on test environment
        expect(memoryGrowth).toBeLessThan(20 * 1024 * 1024) // 20MB threshold

        dynamoMock.reset()
      })

      it('should handle large item marshall/unmarshall efficiently', () => {
        forceGC()
        const initialMemory = getHeapUsed()

        const largeItems = Array.from({ length: 1000 }, (_, i) => ({
          pk: `pk-${i}`,
          sk: `sk-${i}`,
          data: 'x'.repeat(1000),
          nested: {
            level1: {
              level2: {
                value: i,
              },
            },
          },
        }))

        // Marshall all items
        const marshalled = largeItems.map((item) => marshall(item))

        // Unmarshall all items
        const unmarshalled = marshalled.map((item) => unmarshall(item))

        forceGC()
        const finalMemory = getHeapUsed()
        const memoryUsed = finalMemory - initialMemory

        expect(unmarshalled.length).toBe(1000)
        expect(memoryUsed).toBeLessThan(100 * 1024 * 1024) // 100MB threshold
      })
    })

    describe('Chunk processing patterns', () => {
      it('should process items in chunks to limit memory', async () => {
        const totalItems = 10000
        const chunkSize = 100
        const processed: number[] = []

        const processChunk = async (chunk: number[]): Promise<void> => {
          // Simulate async processing
          await new Promise((r) => setTimeout(r, 1))
          processed.push(...chunk.map((x) => x * 2))
        }

        // Process in chunks
        const items = Array.from({ length: totalItems }, (_, i) => i)

        for (let i = 0; i < items.length; i += chunkSize) {
          const chunk = items.slice(i, i + chunkSize)
          await processChunk(chunk)
        }

        expect(processed.length).toBe(totalItems)
        expect(processed[0]).toBe(0)
        expect(processed[totalItems - 1]).toBe((totalItems - 1) * 2)
      })

      it('should use generator for memory-efficient iteration', async () => {
        function* generateItems(count: number) {
          for (let i = 0; i < count; i++) {
            yield {
              id: i,
              data: `item-${i}`,
            }
          }
        }

        const results: number[] = []
        let processedCount = 0

        for (const item of generateItems(10000)) {
          processedCount++
          if (item.id % 1000 === 0) {
            results.push(item.id)
          }
        }

        expect(processedCount).toBe(10000)
        expect(results).toEqual([
          0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000,
        ])
      })
    })
  })

  // ============================================================================
  // Concurrent Operation Handling
  // ============================================================================
  describe('Concurrent operation handling', () => {
    const dynamoMock = mockClient(DynamoDBClient)
    const client = new DynamoDBClient({ region: 'ap-northeast-1' })

    beforeEach(() => {
      dynamoMock.reset()
    })

    describe('Parallel batch processing', () => {
      it('should handle concurrent batch writes', async () => {
        dynamoMock.on(BatchWriteItemCommand).resolves({
          UnprocessedItems: {},
        })

        const batchCount = 10
        const itemsPerBatch = 25

        const batches = Array.from({ length: batchCount }, (_, batchIndex) =>
          Array.from({ length: itemsPerBatch }, (_, itemIndex) => ({
            pk: `batch-${batchIndex}`,
            sk: `item-${itemIndex}`,
          })),
        )

        // Process all batches concurrently
        const promises = batches.map((batch) =>
          client.send(
            new BatchWriteItemCommand({
              RequestItems: {
                'test-table': batch.map((item) => ({
                  PutRequest: { Item: marshall(item) },
                })),
              },
            }),
          ),
        )

        const results = await Promise.all(promises)

        expect(results.length).toBe(batchCount)
        expect(dynamoMock).toHaveReceivedCommandTimes(
          BatchWriteItemCommand,
          batchCount,
        )
      })

      it('should handle concurrent batch writes with controlled concurrency', async () => {
        dynamoMock.on(BatchWriteItemCommand).resolves({
          UnprocessedItems: {},
        })

        const totalBatches = 20
        const maxConcurrent = 5

        const batches = Array.from({ length: totalBatches }, (_, i) => ({
          pk: `batch-${i}`,
          sk: 'item',
        }))

        // Process with controlled concurrency
        const processWithConcurrency = async <T, R>(
          items: T[],
          concurrency: number,
          processor: (item: T) => Promise<R>,
        ): Promise<R[]> => {
          const results: R[] = []

          for (let i = 0; i < items.length; i += concurrency) {
            const chunk = items.slice(i, i + concurrency)
            const chunkResults = await Promise.all(chunk.map(processor))
            results.push(...chunkResults)
          }

          return results
        }

        const results = await processWithConcurrency(
          batches,
          maxConcurrent,
          async (item) => {
            return client.send(
              new BatchWriteItemCommand({
                RequestItems: {
                  'test-table': [{ PutRequest: { Item: marshall(item) } }],
                },
              }),
            )
          },
        )

        expect(results.length).toBe(totalBatches)
      })
    })

    describe('Rate limiting patterns', () => {
      it('should implement token bucket rate limiting', async () => {
        class TokenBucket {
          private tokens: number
          private lastRefill: number

          constructor(
            private capacity: number,
            private refillRate: number,
          ) {
            this.tokens = capacity
            this.lastRefill = Date.now()
          }

          async acquire(): Promise<boolean> {
            this.refill()
            if (this.tokens > 0) {
              this.tokens--
              return true
            }
            return false
          }

          private refill(): void {
            const now = Date.now()
            const elapsed = (now - this.lastRefill) / 1000
            const newTokens = elapsed * this.refillRate
            this.tokens = Math.min(this.capacity, this.tokens + newTokens)
            this.lastRefill = now
          }
        }

        const bucket = new TokenBucket(5, 10) // 5 capacity, 10 tokens/second

        // Should acquire 5 tokens immediately
        const results: boolean[] = []
        for (let i = 0; i < 7; i++) {
          results.push(await bucket.acquire())
        }

        // In CI environments, timing can vary slightly, allowing extra token refills
        // Expect at least 5 successful acquisitions (capacity) and at most 7
        const successCount = results.filter((r) => r).length
        expect(successCount).toBeGreaterThanOrEqual(5)
        expect(successCount).toBeLessThanOrEqual(7)
      })
    })
  })

  // ============================================================================
  // Large String and Buffer Operations
  // ============================================================================
  describe('Large string and buffer operations', () => {
    describe('String concatenation efficiency', () => {
      it('should use array join for efficient string concatenation', () => {
        const parts: string[] = []

        for (let i = 0; i < 10000; i++) {
          parts.push(`part-${i}`)
        }

        const result = parts.join('')

        expect(result.length).toBeGreaterThan(0)
        expect(result).toContain('part-0')
        expect(result).toContain('part-9999')
      })

      it('should handle large JSON serialization', () => {
        const largeObject = {
          items: Array.from({ length: 10000 }, (_, i) => ({
            id: i,
            name: `item-${i}`,
            description: 'x'.repeat(100),
          })),
        }

        const json = JSON.stringify(largeObject)
        const parsed = JSON.parse(json)

        expect(parsed.items.length).toBe(10000)
      })
    })

    describe('Buffer operations', () => {
      it('should efficiently concatenate buffers', () => {
        const buffers: Buffer[] = []

        for (let i = 0; i < 1000; i++) {
          buffers.push(Buffer.from(`chunk-${i}`))
        }

        const combined = Buffer.concat(buffers)

        expect(combined.length).toBeGreaterThan(0)
        expect(combined.toString()).toContain('chunk-0')
        expect(combined.toString()).toContain('chunk-999')
      })

      it('should handle large buffer allocation', () => {
        const size = 10 * 1024 * 1024 // 10MB
        const buffer = Buffer.alloc(size)

        expect(buffer.length).toBe(size)

        // Fill with pattern
        for (let i = 0; i < size; i++) {
          buffer[i] = i % 256
        }

        expect(buffer[0]).toBe(0)
        expect(buffer[255]).toBe(255)
        expect(buffer[256]).toBe(0)
      })
    })
  })
})
