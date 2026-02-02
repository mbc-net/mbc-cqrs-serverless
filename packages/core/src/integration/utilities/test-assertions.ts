/**
 * Test Assertions
 *
 * Provides reusable assertion functions for AWS SDK error patterns
 * and common test scenarios. These helpers ensure consistent
 * validation across integration tests.
 *
 * Usage:
 *   import {
 *     assertIsRetriableError,
 *     assertIsThrottlingError,
 *     assertErrorMetadata
 *   } from './utilities/test-assertions'
 *
 *   it('should be retriable', () => {
 *     assertIsRetriableError(error)
 *   })
 */

import type { AWSError } from './aws-error-factory'

// ============================================================================
// Error Type Assertions
// ============================================================================

/**
 * Asserts that an error is retriable based on AWS SDK v3 patterns
 */
export function assertIsRetriableError(error: unknown): void {
  const awsError = error as AWSError

  const isRetriable =
    awsError.$retryable !== undefined ||
    (awsError.$metadata?.httpStatusCode &&
      awsError.$metadata.httpStatusCode >= 500) ||
    awsError.$metadata?.httpStatusCode === 429 ||
    [
      'ProvisionedThroughputExceededException',
      'ThrottlingException',
      'InternalServerError',
      'ServiceUnavailable',
      'RequestLimitExceeded',
      'SlowDown',
      'TooManyRequestsException',
    ].includes(awsError.name)

  if (!isRetriable) {
    throw new Error(
      `Expected error to be retriable, but got: ${awsError.name} (status: ${awsError.$metadata?.httpStatusCode})`,
    )
  }
}

/**
 * Asserts that an error is NOT retriable
 */
export function assertIsNotRetriableError(error: unknown): void {
  const awsError = error as AWSError

  const nonRetriablePatterns =
    !awsError.$retryable &&
    awsError.$metadata?.httpStatusCode !== undefined &&
    awsError.$metadata.httpStatusCode < 500 &&
    awsError.$metadata.httpStatusCode !== 429

  if (!nonRetriablePatterns) {
    throw new Error(
      `Expected error to NOT be retriable, but got: ${awsError.name} (status: ${awsError.$metadata?.httpStatusCode}, $retryable: ${JSON.stringify(awsError.$retryable)})`,
    )
  }
}

/**
 * Asserts that an error is a throttling error
 */
export function assertIsThrottlingError(error: unknown): void {
  const awsError = error as AWSError

  if (awsError.$retryable?.throttling !== true) {
    throw new Error(
      `Expected throttling error, but got: ${awsError.name} ($retryable: ${JSON.stringify(awsError.$retryable)})`,
    )
  }
}

/**
 * Asserts that an error is a network error
 */
export function assertIsNetworkError(error: unknown): void {
  const err = error as Error & { code?: string }

  const networkErrorCodes = [
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENETUNREACH',
    'ENOTFOUND',
    'EPIPE',
    'EAI_AGAIN',
  ]

  const isNetwork =
    (err.code && networkErrorCodes.includes(err.code)) ||
    err.message.toLowerCase().includes('socket hang up') ||
    err.message.toLowerCase().includes('network error') ||
    err.message.toLowerCase().includes('connection reset') ||
    err.message.toLowerCase().includes('connection refused')

  if (!isNetwork) {
    throw new Error(
      `Expected network error, but got: ${err.message} (code: ${err.code})`,
    )
  }
}

/**
 * Asserts that an error is a timeout error
 */
export function assertIsTimeoutError(error: unknown): void {
  const err = error as Error & { code?: string; name?: string }

  const isTimeout =
    err.code === 'ETIMEDOUT' ||
    err.name === 'TimeoutError' ||
    err.message.toLowerCase().includes('timeout') ||
    err.message.toLowerCase().includes('timed out')

  if (!isTimeout) {
    throw new Error(
      `Expected timeout error, but got: ${err.message} (name: ${err.name}, code: ${err.code})`,
    )
  }
}

// ============================================================================
// Error Metadata Assertions
// ============================================================================

/**
 * Asserts that an error has the expected metadata
 */
export function assertErrorMetadata(
  error: unknown,
  expected: {
    httpStatusCode?: number
    requestId?: string
    name?: string
    fault?: 'client' | 'server'
  },
): void {
  const awsError = error as AWSError

  if (expected.httpStatusCode !== undefined) {
    if (awsError.$metadata?.httpStatusCode !== expected.httpStatusCode) {
      throw new Error(
        `Expected httpStatusCode ${expected.httpStatusCode}, but got ${awsError.$metadata?.httpStatusCode}`,
      )
    }
  }

  if (expected.requestId !== undefined) {
    if (awsError.$metadata?.requestId !== expected.requestId) {
      throw new Error(
        `Expected requestId ${expected.requestId}, but got ${awsError.$metadata?.requestId}`,
      )
    }
  }

  if (expected.name !== undefined) {
    if (awsError.name !== expected.name) {
      throw new Error(`Expected error name ${expected.name}, but got ${awsError.name}`)
    }
  }

  if (expected.fault !== undefined) {
    if (awsError.$fault !== expected.fault) {
      throw new Error(
        `Expected fault ${expected.fault}, but got ${awsError.$fault}`,
      )
    }
  }
}

/**
 * Asserts that an error has a valid request ID
 */
export function assertHasRequestId(error: unknown): void {
  const awsError = error as AWSError

  if (!awsError.$metadata?.requestId) {
    throw new Error('Expected error to have a requestId in $metadata')
  }
}

/**
 * Asserts that an error is a client fault (4xx)
 */
export function assertIsClientFault(error: unknown): void {
  const awsError = error as AWSError

  if (awsError.$fault !== 'client') {
    throw new Error(`Expected client fault, but got ${awsError.$fault}`)
  }
}

/**
 * Asserts that an error is a server fault (5xx)
 */
export function assertIsServerFault(error: unknown): void {
  const awsError = error as AWSError

  if (awsError.$fault !== 'server') {
    throw new Error(`Expected server fault, but got ${awsError.$fault}`)
  }
}

// ============================================================================
// Response Assertions
// ============================================================================

/**
 * Asserts that a response has the expected structure
 */
export function assertResponseStructure<T extends object>(
  response: unknown,
  expectedKeys: Array<keyof T>,
): void {
  if (typeof response !== 'object' || response === null) {
    throw new Error(`Expected object response, but got ${typeof response}`)
  }

  const missingKeys = expectedKeys.filter(
    (key) => !(key in (response as object)),
  )

  if (missingKeys.length > 0) {
    throw new Error(
      `Response missing expected keys: ${missingKeys.join(', ')}. Got keys: ${Object.keys(response as object).join(', ')}`,
    )
  }
}

/**
 * Asserts that a DynamoDB response has valid metadata
 */
export function assertDynamoDBResponseMetadata(response: unknown): void {
  const resp = response as { $metadata?: { httpStatusCode?: number } }

  if (!resp.$metadata) {
    throw new Error('Expected $metadata in DynamoDB response')
  }

  if (resp.$metadata.httpStatusCode !== 200) {
    throw new Error(
      `Expected httpStatusCode 200, but got ${resp.$metadata.httpStatusCode}`,
    )
  }
}

// ============================================================================
// Async Assertions
// ============================================================================

/**
 * Asserts that an async function throws an error with the expected name
 */
export async function assertThrowsErrorWithName(
  fn: () => Promise<unknown>,
  expectedName: string,
): Promise<void> {
  try {
    await fn()
    throw new Error(`Expected function to throw ${expectedName}, but it did not throw`)
  } catch (error) {
    if ((error as Error).name !== expectedName) {
      throw new Error(
        `Expected error name ${expectedName}, but got ${(error as Error).name}`,
      )
    }
  }
}

/**
 * Asserts that an async function throws an error matching a predicate
 */
export async function assertThrowsErrorMatching(
  fn: () => Promise<unknown>,
  predicate: (error: unknown) => boolean,
  description = 'custom predicate',
): Promise<void> {
  try {
    await fn()
    throw new Error(`Expected function to throw error matching ${description}, but it did not throw`)
  } catch (error) {
    if (!predicate(error)) {
      throw new Error(
        `Error did not match ${description}: ${(error as Error).message}`,
      )
    }
  }
}

// ============================================================================
// Timing Assertions
// ============================================================================

/**
 * Asserts that an async operation completes within a time limit
 */
export async function assertCompletesWithin<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const start = Date.now()
  const result = await fn()
  const duration = Date.now() - start

  if (duration > timeoutMs) {
    throw new Error(
      `Expected operation to complete within ${timeoutMs}ms, but took ${duration}ms`,
    )
  }

  return result
}

/**
 * Asserts that an async operation takes at least a minimum time
 * (useful for testing retry delays)
 */
export async function assertTakesAtLeast<T>(
  fn: () => Promise<T>,
  minMs: number,
): Promise<T> {
  const start = Date.now()
  const result = await fn()
  const duration = Date.now() - start

  if (duration < minMs) {
    throw new Error(
      `Expected operation to take at least ${minMs}ms, but took ${duration}ms`,
    )
  }

  return result
}

// ============================================================================
// Memory Assertions
// ============================================================================

/**
 * Forces garbage collection if available (requires --expose-gc flag)
 */
export function forceGC(): void {
  if (global.gc) {
    global.gc()
  }
}

/**
 * Gets current heap memory usage in bytes
 */
export function getHeapUsed(): number {
  return process.memoryUsage().heapUsed
}

/**
 * Asserts that memory increase is within acceptable limits
 */
export function assertMemoryIncreaseLessThan(
  initialMemory: number,
  maxIncreaseBytes: number,
): void {
  forceGC()
  const currentMemory = getHeapUsed()
  const increase = currentMemory - initialMemory

  if (increase > maxIncreaseBytes) {
    const increaseMB = (increase / 1024 / 1024).toFixed(2)
    const maxMB = (maxIncreaseBytes / 1024 / 1024).toFixed(2)
    throw new Error(
      `Memory increased by ${increaseMB}MB, which exceeds limit of ${maxMB}MB`,
    )
  }
}

/**
 * Runs a function and asserts memory usage stays within limits
 */
export async function assertNoMemoryLeak<T>(
  fn: () => Promise<T>,
  maxIncreaseBytes = 50 * 1024 * 1024, // 50MB default
): Promise<T> {
  forceGC()
  const initialMemory = getHeapUsed()

  const result = await fn()

  assertMemoryIncreaseLessThan(initialMemory, maxIncreaseBytes)

  return result
}

// ============================================================================
// Array/Collection Assertions
// ============================================================================

/**
 * Asserts that an array has the expected length
 */
export function assertArrayLength<T>(
  array: T[],
  expectedLength: number,
): void {
  if (array.length !== expectedLength) {
    throw new Error(
      `Expected array length ${expectedLength}, but got ${array.length}`,
    )
  }
}

/**
 * Asserts that all items in an array match a predicate
 */
export function assertAllMatch<T>(
  array: T[],
  predicate: (item: T) => boolean,
  description = 'predicate',
): void {
  const failingIndex = array.findIndex((item) => !predicate(item))

  if (failingIndex !== -1) {
    throw new Error(
      `Item at index ${failingIndex} did not match ${description}`,
    )
  }
}

/**
 * Asserts that an array contains unique items based on a key function
 */
export function assertUniqueBy<T, K>(
  array: T[],
  keyFn: (item: T) => K,
): void {
  const seen = new Set<K>()
  const duplicates: K[] = []

  array.forEach((item) => {
    const key = keyFn(item)
    if (seen.has(key)) {
      duplicates.push(key)
    }
    seen.add(key)
  })

  if (duplicates.length > 0) {
    throw new Error(`Found duplicate keys: ${duplicates.join(', ')}`)
  }
}
