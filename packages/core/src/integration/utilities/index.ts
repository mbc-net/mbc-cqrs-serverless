/**
 * Integration Test Utilities
 *
 * This module provides shared utilities for integration tests:
 *
 * - aws-error-factory: Factory functions for creating AWS SDK errors
 * - aws-mock-manager: Mock client setup and teardown helpers
 * - test-assertions: Reusable assertion functions
 * - test-data-builders: Test data generation utilities
 *
 * Usage:
 *   import {
 *     createDynamoDBError,
 *     createDynamoDBMock,
 *     assertIsRetriableError,
 *     createTestItem
 *   } from './utilities'
 */

// AWS Error Factory
export {
  type AWSError,
  type AWSErrorMetadata,
  type CreateAWSErrorOptions,
  type DynamoDBErrorName,
  type S3ErrorName,
  type SQSErrorName,
  type SNSErrorName,
  type SFNErrorName,
  type SESErrorName,
  type NetworkErrorCode,
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
} from './aws-error-factory'

// AWS Mock Manager
export {
  type MockClientOptions,
  type MockClientResult,
  AWSMockManager,
  createDynamoDBMock,
  createS3Mock,
  createSQSMock,
  createSNSMock,
  createSFNMock,
  createSESMock,
  setupAWSMocks,
  createTestMocks,
} from './aws-mock-manager'

// Test Assertions
export {
  assertIsRetriableError,
  assertIsNotRetriableError,
  assertIsThrottlingError,
  assertIsNetworkError,
  assertIsTimeoutError,
  assertErrorMetadata,
  assertHasRequestId,
  assertIsClientFault,
  assertIsServerFault,
  assertResponseStructure,
  assertDynamoDBResponseMetadata,
  assertThrowsErrorWithName,
  assertThrowsErrorMatching,
  assertCompletesWithin,
  assertTakesAtLeast,
  forceGC,
  getHeapUsed,
  assertMemoryIncreaseLessThan,
  assertNoMemoryLeak,
  assertArrayLength,
  assertAllMatch,
  assertUniqueBy,
} from './test-assertions'

// Test Data Builders
export {
  type TestItem,
  type CreateTestItemOptions,
  DYNAMODB_BATCH_SIZE,
  createTestItem,
  createTestItems,
  createMarshalledItem,
  createMarshalledItems,
  createKey,
  createKeys,
  createBatchWriteRequest,
  createBatchGetRequest,
  splitIntoBatches,
  createS3Content,
  createS3Metadata,
  createSQSMessageBody,
  createSQSBatchEntries,
  createSNSMessage,
  createSFNInput,
  createSFNExecutionName,
  createRandomString,
  createNestedTestData,
  createMixedTypeTestData,
  createLargeTestData,
  unmarshallItem,
  unmarshallItems,
  marshall,
  unmarshall,
} from './test-data-builders'
