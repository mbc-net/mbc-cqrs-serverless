/**
 * AWS Mock Manager
 *
 * Provides standardized setup and teardown for AWS SDK mock clients
 * in integration tests. This eliminates repetitive mock configuration
 * across test files and ensures consistent mock behavior.
 *
 * Usage:
 *   import { AWSMockManager, createDynamoDBMock } from './utilities/aws-mock-manager'
 *
 *   // Option 1: Use individual mock creators
 *   const { mock, client, reset, restore } = createDynamoDBMock()
 *
 *   // Option 2: Use the manager for multiple services
 *   const manager = new AWSMockManager()
 *   const dynamoDB = manager.getDynamoDB()
 *   const s3 = manager.getS3()
 *
 *   beforeEach(() => manager.resetAll())
 *   afterAll(() => manager.restoreAll())
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { S3Client } from '@aws-sdk/client-s3'
import { SQSClient } from '@aws-sdk/client-sqs'
import { SNSClient } from '@aws-sdk/client-sns'
import { SFNClient } from '@aws-sdk/client-sfn'
import { SESv2Client } from '@aws-sdk/client-sesv2'
import { mockClient, AwsClientStub } from 'aws-sdk-client-mock'

/**
 * Default AWS region for test clients
 */
const DEFAULT_REGION = 'ap-northeast-1'

/**
 * Configuration options for mock clients
 */
export interface MockClientOptions {
  region?: string
  maxAttempts?: number
  retryMode?: 'standard' | 'adaptive'
}

/**
 * Result from creating a mock client
 */
export interface MockClientResult<TClient> {
  /** The mock client stub for configuring responses */
  mock: AwsClientStub<TClient>
  /** The actual client instance configured with the mock */
  client: TClient
  /** Reset the mock to clear all configured behaviors */
  reset: () => void
  /** Restore the mock and destroy the client */
  restore: () => void
}

// ============================================================================
// Individual Mock Creators
// ============================================================================

/**
 * Creates a mocked DynamoDB client
 */
export function createDynamoDBMock(
  options: MockClientOptions = {},
): MockClientResult<DynamoDBClient> {
  const mock = mockClient(DynamoDBClient)
  const client = new DynamoDBClient({
    region: options.region || DEFAULT_REGION,
    maxAttempts: options.maxAttempts,
    retryMode: options.retryMode,
  })

  return {
    mock,
    client,
    reset: () => mock.reset(),
    restore: () => {
      mock.restore()
      client.destroy()
    },
  }
}

/**
 * Creates a mocked S3 client
 */
export function createS3Mock(
  options: MockClientOptions = {},
): MockClientResult<S3Client> {
  const mock = mockClient(S3Client)
  const client = new S3Client({
    region: options.region || DEFAULT_REGION,
    maxAttempts: options.maxAttempts,
    retryMode: options.retryMode,
  })

  return {
    mock,
    client,
    reset: () => mock.reset(),
    restore: () => {
      mock.restore()
      client.destroy()
    },
  }
}

/**
 * Creates a mocked SQS client
 */
export function createSQSMock(
  options: MockClientOptions = {},
): MockClientResult<SQSClient> {
  const mock = mockClient(SQSClient)
  const client = new SQSClient({
    region: options.region || DEFAULT_REGION,
    maxAttempts: options.maxAttempts,
    retryMode: options.retryMode,
  })

  return {
    mock,
    client,
    reset: () => mock.reset(),
    restore: () => {
      mock.restore()
      client.destroy()
    },
  }
}

/**
 * Creates a mocked SNS client
 */
export function createSNSMock(
  options: MockClientOptions = {},
): MockClientResult<SNSClient> {
  const mock = mockClient(SNSClient)
  const client = new SNSClient({
    region: options.region || DEFAULT_REGION,
    maxAttempts: options.maxAttempts,
    retryMode: options.retryMode,
  })

  return {
    mock,
    client,
    reset: () => mock.reset(),
    restore: () => {
      mock.restore()
      client.destroy()
    },
  }
}

/**
 * Creates a mocked Step Functions client
 */
export function createSFNMock(
  options: MockClientOptions = {},
): MockClientResult<SFNClient> {
  const mock = mockClient(SFNClient)
  const client = new SFNClient({
    region: options.region || DEFAULT_REGION,
    maxAttempts: options.maxAttempts,
    retryMode: options.retryMode,
  })

  return {
    mock,
    client,
    reset: () => mock.reset(),
    restore: () => {
      mock.restore()
      client.destroy()
    },
  }
}

/**
 * Creates a mocked SES v2 client
 */
export function createSESMock(
  options: MockClientOptions = {},
): MockClientResult<SESv2Client> {
  const mock = mockClient(SESv2Client)
  const client = new SESv2Client({
    region: options.region || DEFAULT_REGION,
    maxAttempts: options.maxAttempts,
    retryMode: options.retryMode,
  })

  return {
    mock,
    client,
    reset: () => mock.reset(),
    restore: () => {
      mock.restore()
      client.destroy()
    },
  }
}

// ============================================================================
// AWS Mock Manager Class
// ============================================================================

/**
 * Manages multiple AWS mock clients for test suites
 */
export class AWSMockManager {
  private dynamoDB?: MockClientResult<DynamoDBClient>
  private s3?: MockClientResult<S3Client>
  private sqs?: MockClientResult<SQSClient>
  private sns?: MockClientResult<SNSClient>
  private sfn?: MockClientResult<SFNClient>
  private ses?: MockClientResult<SESv2Client>
  private options: MockClientOptions

  constructor(options: MockClientOptions = {}) {
    this.options = options
  }

  /**
   * Gets or creates the DynamoDB mock
   */
  getDynamoDB(): MockClientResult<DynamoDBClient> {
    if (!this.dynamoDB) {
      this.dynamoDB = createDynamoDBMock(this.options)
    }
    return this.dynamoDB
  }

  /**
   * Gets or creates the S3 mock
   */
  getS3(): MockClientResult<S3Client> {
    if (!this.s3) {
      this.s3 = createS3Mock(this.options)
    }
    return this.s3
  }

  /**
   * Gets or creates the SQS mock
   */
  getSQS(): MockClientResult<SQSClient> {
    if (!this.sqs) {
      this.sqs = createSQSMock(this.options)
    }
    return this.sqs
  }

  /**
   * Gets or creates the SNS mock
   */
  getSNS(): MockClientResult<SNSClient> {
    if (!this.sns) {
      this.sns = createSNSMock(this.options)
    }
    return this.sns
  }

  /**
   * Gets or creates the Step Functions mock
   */
  getSFN(): MockClientResult<SFNClient> {
    if (!this.sfn) {
      this.sfn = createSFNMock(this.options)
    }
    return this.sfn
  }

  /**
   * Gets or creates the SES mock
   */
  getSES(): MockClientResult<SESv2Client> {
    if (!this.ses) {
      this.ses = createSESMock(this.options)
    }
    return this.ses
  }

  /**
   * Resets all active mocks
   */
  resetAll(): void {
    this.dynamoDB?.reset()
    this.s3?.reset()
    this.sqs?.reset()
    this.sns?.reset()
    this.sfn?.reset()
    this.ses?.reset()
  }

  /**
   * Restores all mocks and destroys clients
   */
  restoreAll(): void {
    this.dynamoDB?.restore()
    this.s3?.restore()
    this.sqs?.restore()
    this.sns?.restore()
    this.sfn?.restore()
    this.ses?.restore()

    this.dynamoDB = undefined
    this.s3 = undefined
    this.sqs = undefined
    this.sns = undefined
    this.sfn = undefined
    this.ses = undefined
  }
}

// ============================================================================
// Test Setup Helpers
// ============================================================================

/**
 * Creates a standard test setup with beforeEach/afterAll hooks
 * for use with Jest describe blocks
 */
export function setupAWSMocks(
  services: Array<'dynamodb' | 's3' | 'sqs' | 'sns' | 'sfn' | 'ses'>,
  options: MockClientOptions = {},
): {
  manager: AWSMockManager
  beforeEachHook: () => void
  afterAllHook: () => void
} {
  const manager = new AWSMockManager(options)

  // Initialize requested services
  services.forEach((service) => {
    switch (service) {
      case 'dynamodb':
        manager.getDynamoDB()
        break
      case 's3':
        manager.getS3()
        break
      case 'sqs':
        manager.getSQS()
        break
      case 'sns':
        manager.getSNS()
        break
      case 'sfn':
        manager.getSFN()
        break
      case 'ses':
        manager.getSES()
        break
    }
  })

  return {
    manager,
    beforeEachHook: () => manager.resetAll(),
    afterAllHook: () => manager.restoreAll(),
  }
}

/**
 * Quick setup function that returns individual mocks for common patterns
 */
export function createTestMocks<
  T extends Array<'dynamodb' | 's3' | 'sqs' | 'sns' | 'sfn' | 'ses'>,
>(
  services: T,
  options: MockClientOptions = {},
): {
  [K in T[number]]: K extends 'dynamodb'
    ? MockClientResult<DynamoDBClient>
    : K extends 's3'
      ? MockClientResult<S3Client>
      : K extends 'sqs'
        ? MockClientResult<SQSClient>
        : K extends 'sns'
          ? MockClientResult<SNSClient>
          : K extends 'sfn'
            ? MockClientResult<SFNClient>
            : K extends 'ses'
              ? MockClientResult<SESv2Client>
              : never
} & {
  resetAll: () => void
  restoreAll: () => void
} {
  const mocks: Record<string, MockClientResult<unknown>> = {}

  services.forEach((service) => {
    switch (service) {
      case 'dynamodb':
        mocks.dynamodb = createDynamoDBMock(options)
        break
      case 's3':
        mocks.s3 = createS3Mock(options)
        break
      case 'sqs':
        mocks.sqs = createSQSMock(options)
        break
      case 'sns':
        mocks.sns = createSNSMock(options)
        break
      case 'sfn':
        mocks.sfn = createSFNMock(options)
        break
      case 'ses':
        mocks.ses = createSESMock(options)
        break
    }
  })

  return {
    ...mocks,
    resetAll: () => {
      Object.values(mocks).forEach((m) => m.reset())
    },
    restoreAll: () => {
      Object.values(mocks).forEach((m) => m.restore())
    },
  } as ReturnType<typeof createTestMocks<T>>
}
