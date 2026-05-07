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
  createDynamoDBError,
  createHttpStatusError,
  createNetworkError,
  createS3Error,
  createSESError,
  createSFNError,
  createSNSError,
  createSQSError,
  createTimeoutError,
  type DynamoDBErrorName,
  isNetworkError,
  isRetriableAWSError,
  isThrottlingError,
  type NetworkErrorCode,
  type S3ErrorName,
  type SESErrorName,
  type SFNErrorName,
  type SNSErrorName,
  type SQSErrorName,
} from './aws-error-factory'

// AWS Mock Manager
export {
  AWSMockManager,
  createDynamoDBMock,
  createS3Mock,
  createSESMock,
  createSFNMock,
  createSNSMock,
  createSQSMock,
  createTestMocks,
  type MockClientOptions,
  type MockClientResult,
  setupAWSMocks,
} from './aws-mock-manager'

// Test Assertions
export {
  assertAllMatch,
  assertArrayLength,
  assertCompletesWithin,
  assertDynamoDBResponseMetadata,
  assertErrorMetadata,
  assertHasRequestId,
  assertIsClientFault,
  assertIsNetworkError,
  assertIsNotRetriableError,
  assertIsRetriableError,
  assertIsServerFault,
  assertIsThrottlingError,
  assertIsTimeoutError,
  assertMemoryIncreaseLessThan,
  assertNoMemoryLeak,
  assertResponseStructure,
  assertTakesAtLeast,
  assertThrowsErrorMatching,
  assertThrowsErrorWithName,
  assertUniqueBy,
  forceGC,
  getHeapUsed,
} from './test-assertions'

// Test Data Builders
export {
  createBatchGetRequest,
  createBatchWriteRequest,
  createKey,
  createKeys,
  createLargeTestData,
  createMarshalledItem,
  createMarshalledItems,
  createMixedTypeTestData,
  createNestedTestData,
  createRandomString,
  createS3Content,
  createS3Metadata,
  createSFNExecutionName,
  createSFNInput,
  createSNSMessage,
  createSQSBatchEntries,
  createSQSMessageBody,
  createTestItem,
  type CreateTestItemOptions,
  createTestItems,
  DYNAMODB_BATCH_SIZE,
  marshall,
  splitIntoBatches,
  type TestItem,
  unmarshall,
  unmarshallItem,
  unmarshallItems,
} from './test-data-builders'
