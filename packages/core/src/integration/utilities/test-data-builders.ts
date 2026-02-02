/**
 * Test Data Builders
 *
 * Provides factory functions for creating test data used across
 * integration tests. This eliminates repetitive data creation and
 * ensures consistent test fixtures.
 *
 * Usage:
 *   import {
 *     createTestItem,
 *     createTestItems,
 *     createBatchWriteRequest
 *   } from './utilities/test-data-builders'
 *
 *   const item = createTestItem({ pk: 'user-1', sk: 'profile' })
 *   const items = createTestItems(100)
 */

import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import type { AttributeValue } from '@aws-sdk/client-dynamodb'

// ============================================================================
// DynamoDB Item Builders
// ============================================================================

/**
 * Basic DynamoDB item structure
 */
export interface TestItem {
  pk: string
  sk: string
  [key: string]: unknown
}

/**
 * Options for creating test items
 */
export interface CreateTestItemOptions {
  pk?: string
  sk?: string
  data?: Record<string, unknown>
  withTimestamp?: boolean
  withVersion?: number
}

/**
 * Creates a single test item
 */
export function createTestItem(options: CreateTestItemOptions = {}): TestItem {
  const {
    pk = `pk-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    sk = `sk-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    data = {},
    withTimestamp = false,
    withVersion,
  } = options

  const item: TestItem = {
    pk,
    sk,
    ...data,
  }

  if (withTimestamp) {
    item.createdAt = new Date().toISOString()
    item.updatedAt = new Date().toISOString()
  }

  if (withVersion !== undefined) {
    item.version = withVersion
  }

  return item
}

/**
 * Creates multiple test items with sequential IDs
 */
export function createTestItems(
  count: number,
  options: {
    pkPrefix?: string
    skPrefix?: string
    dataGenerator?: (index: number) => Record<string, unknown>
    withTimestamp?: boolean
    withVersion?: boolean
  } = {},
): TestItem[] {
  const {
    pkPrefix = 'pk',
    skPrefix = 'sk',
    dataGenerator = () => ({}),
    withTimestamp = false,
    withVersion = false,
  } = options

  return Array.from({ length: count }, (_, i) =>
    createTestItem({
      pk: `${pkPrefix}-${i}`,
      sk: `${skPrefix}-${i}`,
      data: dataGenerator(i),
      withTimestamp,
      withVersion: withVersion ? 1 : undefined,
    }),
  )
}

/**
 * Creates a marshalled DynamoDB item
 */
export function createMarshalledItem(
  options: CreateTestItemOptions = {},
): Record<string, AttributeValue> {
  const item = createTestItem(options)
  return marshall(item)
}

/**
 * Creates multiple marshalled DynamoDB items
 */
export function createMarshalledItems(
  count: number,
  options: Parameters<typeof createTestItems>[1] = {},
): Record<string, AttributeValue>[] {
  return createTestItems(count, options).map((item) => marshall(item))
}

// ============================================================================
// DynamoDB Key Builders
// ============================================================================

/**
 * Creates a DynamoDB key object
 */
export function createKey(
  pk: string,
  sk: string,
): Record<string, AttributeValue> {
  return marshall({ pk, sk })
}

/**
 * Creates multiple DynamoDB keys
 */
export function createKeys(
  items: Array<{ pk: string; sk: string }>,
): Record<string, AttributeValue>[] {
  return items.map(({ pk, sk }) => createKey(pk, sk))
}

// ============================================================================
// Batch Operation Builders
// ============================================================================

/**
 * DynamoDB batch size limit
 */
export const DYNAMODB_BATCH_SIZE = 25

/**
 * Creates a BatchWriteItem request structure for DynamoDB
 */
export function createBatchWriteRequest(
  tableName: string,
  items: TestItem[],
): {
  RequestItems: {
    [tableName: string]: Array<{
      PutRequest: { Item: Record<string, AttributeValue> }
    }>
  }
} {
  return {
    RequestItems: {
      [tableName]: items.map((item) => ({
        PutRequest: { Item: marshall(item) },
      })),
    },
  }
}

/**
 * Creates a BatchGetItem request structure for DynamoDB
 */
export function createBatchGetRequest(
  tableName: string,
  keys: Array<{ pk: string; sk: string }>,
): {
  RequestItems: {
    [tableName: string]: {
      Keys: Record<string, AttributeValue>[]
    }
  }
} {
  return {
    RequestItems: {
      [tableName]: {
        Keys: createKeys(keys),
      },
    },
  }
}

/**
 * Splits items into batches of the specified size
 */
export function splitIntoBatches<T>(
  items: T[],
  batchSize: number = DYNAMODB_BATCH_SIZE,
): T[][] {
  const batches: T[][] = []

  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize))
  }

  return batches
}

// ============================================================================
// S3 Object Builders
// ============================================================================

/**
 * Creates test content for S3 objects
 */
export function createS3Content(
  options: {
    type?: 'text' | 'json' | 'binary'
    size?: number
    data?: unknown
  } = {},
): Buffer {
  const { type = 'text', size = 1024, data } = options

  switch (type) {
    case 'json':
      return Buffer.from(
        JSON.stringify(data || { test: true, timestamp: Date.now() }),
      )
    case 'binary':
      return Buffer.alloc(size, 0xff)
    case 'text':
    default:
      return Buffer.from('x'.repeat(size))
  }
}

/**
 * Creates S3 object metadata
 */
export function createS3Metadata(
  options: {
    contentType?: string
    customMetadata?: Record<string, string>
  } = {},
): {
  ContentType: string
  Metadata?: Record<string, string>
} {
  const { contentType = 'application/octet-stream', customMetadata } = options

  return {
    ContentType: contentType,
    ...(customMetadata && { Metadata: customMetadata }),
  }
}

// ============================================================================
// SQS Message Builders
// ============================================================================

/**
 * Creates an SQS message body
 */
export function createSQSMessageBody<T = Record<string, unknown>>(
  data: T,
): string {
  return JSON.stringify(data)
}

/**
 * Creates multiple SQS message entries for batch operations
 */
export function createSQSBatchEntries(
  messages: Array<{
    id: string
    body: unknown
    delaySeconds?: number
    messageAttributes?: Record<
      string,
      { DataType: string; StringValue?: string }
    >
  }>,
): Array<{
  Id: string
  MessageBody: string
  DelaySeconds?: number
  MessageAttributes?: Record<string, { DataType: string; StringValue?: string }>
}> {
  return messages.map(({ id, body, delaySeconds, messageAttributes }) => ({
    Id: id,
    MessageBody: JSON.stringify(body),
    ...(delaySeconds !== undefined && { DelaySeconds: delaySeconds }),
    ...(messageAttributes && { MessageAttributes: messageAttributes }),
  }))
}

// ============================================================================
// SNS Message Builders
// ============================================================================

/**
 * Creates an SNS message for publishing
 */
export function createSNSMessage(
  options: {
    subject?: string
    message: unknown
    messageAttributes?: Record<
      string,
      { DataType: string; StringValue?: string }
    >
  },
): {
  Subject?: string
  Message: string
  MessageAttributes?: Record<string, { DataType: string; StringValue?: string }>
} {
  const { subject, message, messageAttributes } = options

  return {
    ...(subject && { Subject: subject }),
    Message: typeof message === 'string' ? message : JSON.stringify(message),
    ...(messageAttributes && { MessageAttributes: messageAttributes }),
  }
}

// ============================================================================
// Step Functions Input Builders
// ============================================================================

/**
 * Creates Step Functions execution input
 */
export function createSFNInput<T = Record<string, unknown>>(data: T): string {
  return JSON.stringify(data)
}

/**
 * Creates a Step Functions execution name
 */
export function createSFNExecutionName(prefix = 'test-execution'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`
}

// ============================================================================
// Generic Test Data Generators
// ============================================================================

/**
 * Creates a random string of specified length
 */
export function createRandomString(length: number): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Creates test data with nested structures
 */
export function createNestedTestData(
  depth: number,
  breadth: number = 3,
): Record<string, unknown> {
  if (depth <= 0) {
    return { value: createRandomString(10) }
  }

  const result: Record<string, unknown> = {}
  for (let i = 0; i < breadth; i++) {
    result[`level_${depth}_item_${i}`] = createNestedTestData(depth - 1, breadth)
  }
  return result
}

/**
 * Creates test data with various JavaScript types
 */
export function createMixedTypeTestData(): Record<string, unknown> {
  return {
    stringValue: 'test string',
    numberValue: 42,
    floatValue: 3.14159,
    booleanTrue: true,
    booleanFalse: false,
    nullValue: null,
    arrayValue: [1, 2, 3, 'four', { five: 5 }],
    objectValue: {
      nested: {
        deep: {
          value: 'deep value',
        },
      },
    },
    dateString: new Date().toISOString(),
    emptyString: '',
    emptyArray: [],
    emptyObject: {},
    largeNumber: Number.MAX_SAFE_INTEGER,
    negativeNumber: -999,
    zeroValue: 0,
  }
}

/**
 * Creates large test data for performance/memory tests
 */
export function createLargeTestData(
  options: {
    itemCount?: number
    stringLength?: number
    includeNested?: boolean
  } = {},
): Record<string, unknown> {
  const {
    itemCount = 1000,
    stringLength = 100,
    includeNested = false,
  } = options

  const items = Array.from({ length: itemCount }, (_, i) => ({
    id: i,
    name: `item-${i}`,
    data: createRandomString(stringLength),
    ...(includeNested && { nested: createNestedTestData(2, 2) }),
  }))

  return {
    items,
    metadata: {
      totalCount: itemCount,
      generatedAt: new Date().toISOString(),
    },
  }
}

// ============================================================================
// Unmarshall Utilities
// ============================================================================

/**
 * Unmarshalls a DynamoDB item to a plain JavaScript object
 */
export function unmarshallItem<T = Record<string, unknown>>(
  item: Record<string, AttributeValue>,
): T {
  return unmarshall(item) as T
}

/**
 * Unmarshalls multiple DynamoDB items
 */
export function unmarshallItems<T = Record<string, unknown>>(
  items: Record<string, AttributeValue>[],
): T[] {
  return items.map((item) => unmarshallItem<T>(item))
}

// ============================================================================
// Index File Export
// ============================================================================

/**
 * Re-export for convenience
 */
export { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
