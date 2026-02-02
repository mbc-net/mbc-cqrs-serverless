/**
 * AWS Error Factory
 *
 * Provides standardized factory functions for creating AWS SDK errors
 * used in integration tests. This eliminates code duplication across
 * test files and ensures consistent error structure.
 *
 * Usage:
 *   import { createDynamoDBError, createS3Error } from './utilities/aws-error-factory'
 *
 *   const error = createDynamoDBError('ProvisionedThroughputExceededException', {
 *     message: 'Rate exceeded',
 *     httpStatusCode: 400,
 *     throttling: true,
 *   })
 */

/**
 * Base AWS error structure used across all AWS SDK errors
 */
export interface AWSErrorMetadata {
  httpStatusCode?: number
  requestId?: string
  extendedRequestId?: string
  cfId?: string
  attempts?: number
  totalRetryDelay?: number
}

/**
 * Extended error type that matches AWS SDK v3 error structure
 */
export interface AWSError extends Error {
  name: string
  $metadata: AWSErrorMetadata
  $fault?: 'client' | 'server'
  $retryable?: {
    throttling?: boolean
  }
  $service?: string
  code?: string
  retryAfterSeconds?: number
  time?: Date
}

/**
 * Options for creating AWS errors
 */
export interface CreateAWSErrorOptions {
  message?: string
  httpStatusCode?: number
  requestId?: string
  throttling?: boolean
  fault?: 'client' | 'server'
  retryAfterSeconds?: number
  code?: string
}

/**
 * Creates a base AWS error with the standard structure
 */
function createBaseAWSError(
  name: string,
  options: CreateAWSErrorOptions = {},
): AWSError {
  const {
    message = name,
    httpStatusCode = 400,
    requestId = `test-request-${Date.now()}`,
    throttling,
    fault = httpStatusCode >= 500 ? 'server' : 'client',
    retryAfterSeconds,
    code,
  } = options

  const error = new Error(message) as AWSError
  error.name = name
  error.$metadata = {
    httpStatusCode,
    requestId,
  }
  error.$fault = fault

  if (throttling !== undefined) {
    error.$retryable = { throttling }
  }

  if (retryAfterSeconds !== undefined) {
    error.retryAfterSeconds = retryAfterSeconds
  }

  if (code !== undefined) {
    error.code = code
  }

  return error
}

// ============================================================================
// DynamoDB Errors
// ============================================================================

/**
 * Common DynamoDB error names
 */
export type DynamoDBErrorName =
  | 'ProvisionedThroughputExceededException'
  | 'ResourceNotFoundException'
  | 'ConditionalCheckFailedException'
  | 'ValidationException'
  | 'TransactionCanceledException'
  | 'TransactionConflictException'
  | 'ItemCollectionSizeLimitExceededException'
  | 'RequestLimitExceeded'
  | 'InternalServerError'
  | 'ServiceUnavailable'
  | 'ThrottlingException'
  | 'AccessDeniedException'

/**
 * Creates a DynamoDB-specific error
 */
export function createDynamoDBError(
  name: DynamoDBErrorName,
  options: CreateAWSErrorOptions = {},
): AWSError {
  const defaultOptions: Partial<CreateAWSErrorOptions> = {}

  // Set default properties based on error type
  switch (name) {
    case 'ProvisionedThroughputExceededException':
    case 'ThrottlingException':
    case 'RequestLimitExceeded':
      defaultOptions.throttling = true
      defaultOptions.httpStatusCode = 400
      break
    case 'InternalServerError':
      defaultOptions.httpStatusCode = 500
      defaultOptions.fault = 'server'
      break
    case 'ServiceUnavailable':
      defaultOptions.httpStatusCode = 503
      defaultOptions.fault = 'server'
      break
    case 'ValidationException':
    case 'ConditionalCheckFailedException':
    case 'ResourceNotFoundException':
      defaultOptions.httpStatusCode = 400
      defaultOptions.fault = 'client'
      break
    case 'TransactionCanceledException':
    case 'TransactionConflictException':
      defaultOptions.httpStatusCode = 400
      break
    case 'ItemCollectionSizeLimitExceededException':
      defaultOptions.httpStatusCode = 400
      break
    case 'AccessDeniedException':
      defaultOptions.httpStatusCode = 403
      break
  }

  const error = createBaseAWSError(name, { ...defaultOptions, ...options })
  error.$service = 'DynamoDB'
  return error
}

// ============================================================================
// S3 Errors
// ============================================================================

/**
 * Common S3 error names
 */
export type S3ErrorName =
  | 'NoSuchKey'
  | 'NoSuchBucket'
  | 'BucketNotEmpty'
  | 'BucketAlreadyExists'
  | 'BucketAlreadyOwnedByYou'
  | 'AccessDenied'
  | 'InvalidAccessKeyId'
  | 'SignatureDoesNotMatch'
  | 'EntityTooLarge'
  | 'EntityTooSmall'
  | 'InvalidPart'
  | 'InvalidPartOrder'
  | 'NoSuchUpload'
  | 'SlowDown'
  | 'InternalError'
  | 'ServiceUnavailable'

/**
 * Creates an S3-specific error
 */
export function createS3Error(
  name: S3ErrorName,
  options: CreateAWSErrorOptions = {},
): AWSError {
  const defaultOptions: Partial<CreateAWSErrorOptions> = {}

  switch (name) {
    case 'NoSuchKey':
    case 'NoSuchBucket':
    case 'NoSuchUpload':
      defaultOptions.httpStatusCode = 404
      break
    case 'AccessDenied':
    case 'InvalidAccessKeyId':
    case 'SignatureDoesNotMatch':
      defaultOptions.httpStatusCode = 403
      break
    case 'EntityTooLarge':
      defaultOptions.httpStatusCode = 400
      break
    case 'SlowDown':
      defaultOptions.httpStatusCode = 503
      defaultOptions.throttling = true
      break
    case 'InternalError':
      defaultOptions.httpStatusCode = 500
      defaultOptions.fault = 'server'
      break
    case 'ServiceUnavailable':
      defaultOptions.httpStatusCode = 503
      defaultOptions.fault = 'server'
      break
    case 'BucketNotEmpty':
    case 'BucketAlreadyExists':
    case 'BucketAlreadyOwnedByYou':
      defaultOptions.httpStatusCode = 409
      break
  }

  const error = createBaseAWSError(name, { ...defaultOptions, ...options })
  error.$service = 'S3'
  return error
}

// ============================================================================
// SQS Errors
// ============================================================================

/**
 * Common SQS error names
 */
export type SQSErrorName =
  | 'QueueDoesNotExist'
  | 'QueueDeletedRecently'
  | 'QueueNameExists'
  | 'InvalidMessageContents'
  | 'MessageNotInflight'
  | 'ReceiptHandleIsInvalid'
  | 'PurgeQueueInProgress'
  | 'BatchEntryIdsNotDistinct'
  | 'BatchRequestTooLong'
  | 'EmptyBatchRequest'
  | 'InvalidBatchEntryId'
  | 'TooManyEntriesInBatchRequest'
  | 'OverLimit'
  | 'ThrottlingException'
  | 'AccessDeniedException'

/**
 * Creates an SQS-specific error
 */
export function createSQSError(
  name: SQSErrorName,
  options: CreateAWSErrorOptions = {},
): AWSError {
  const defaultOptions: Partial<CreateAWSErrorOptions> = {}

  switch (name) {
    case 'QueueDoesNotExist':
      defaultOptions.httpStatusCode = 400
      break
    case 'ThrottlingException':
    case 'OverLimit':
      defaultOptions.throttling = true
      defaultOptions.httpStatusCode = 400
      break
    case 'AccessDeniedException':
      defaultOptions.httpStatusCode = 403
      break
    case 'InvalidMessageContents':
    case 'BatchEntryIdsNotDistinct':
    case 'BatchRequestTooLong':
    case 'EmptyBatchRequest':
    case 'InvalidBatchEntryId':
    case 'TooManyEntriesInBatchRequest':
      defaultOptions.httpStatusCode = 400
      break
    case 'MessageNotInflight':
    case 'ReceiptHandleIsInvalid':
      defaultOptions.httpStatusCode = 400
      break
  }

  const error = createBaseAWSError(name, { ...defaultOptions, ...options })
  error.$service = 'SQS'
  return error
}

// ============================================================================
// SNS Errors
// ============================================================================

/**
 * Common SNS error names
 */
export type SNSErrorName =
  | 'NotFoundException'
  | 'TopicLimitExceededException'
  | 'SubscriptionLimitExceededException'
  | 'InvalidParameterException'
  | 'InvalidParameterValueException'
  | 'EndpointDisabledException'
  | 'PlatformApplicationDisabledException'
  | 'AuthorizationErrorException'
  | 'ThrottledException'
  | 'InternalErrorException'

/**
 * Creates an SNS-specific error
 */
export function createSNSError(
  name: SNSErrorName,
  options: CreateAWSErrorOptions = {},
): AWSError {
  const defaultOptions: Partial<CreateAWSErrorOptions> = {}

  switch (name) {
    case 'NotFoundException':
      defaultOptions.httpStatusCode = 404
      break
    case 'TopicLimitExceededException':
    case 'SubscriptionLimitExceededException':
    case 'ThrottledException':
      defaultOptions.throttling = true
      defaultOptions.httpStatusCode = 400
      break
    case 'AuthorizationErrorException':
      defaultOptions.httpStatusCode = 403
      break
    case 'InternalErrorException':
      defaultOptions.httpStatusCode = 500
      defaultOptions.fault = 'server'
      break
    case 'InvalidParameterException':
    case 'InvalidParameterValueException':
      defaultOptions.httpStatusCode = 400
      break
  }

  const error = createBaseAWSError(name, { ...defaultOptions, ...options })
  error.$service = 'SNS'
  return error
}

// ============================================================================
// Step Functions Errors
// ============================================================================

/**
 * Common Step Functions error names
 */
export type SFNErrorName =
  | 'ExecutionDoesNotExist'
  | 'ExecutionAlreadyExists'
  | 'ExecutionLimitExceeded'
  | 'InvalidArn'
  | 'InvalidDefinition'
  | 'InvalidExecutionInput'
  | 'InvalidName'
  | 'InvalidToken'
  | 'StateMachineDoesNotExist'
  | 'StateMachineLimitExceeded'
  | 'TaskDoesNotExist'
  | 'TaskTimedOut'
  | 'ActivityDoesNotExist'
  | 'ActivityLimitExceeded'
  | 'ResourceNotFound'
  | 'ThrottlingException'
  | 'ServiceQuotaExceededException'

/**
 * Creates a Step Functions-specific error
 */
export function createSFNError(
  name: SFNErrorName,
  options: CreateAWSErrorOptions = {},
): AWSError {
  const defaultOptions: Partial<CreateAWSErrorOptions> = {}

  switch (name) {
    case 'ExecutionDoesNotExist':
    case 'StateMachineDoesNotExist':
    case 'TaskDoesNotExist':
    case 'ActivityDoesNotExist':
    case 'ResourceNotFound':
      defaultOptions.httpStatusCode = 400
      break
    case 'ExecutionAlreadyExists':
      defaultOptions.httpStatusCode = 400
      break
    case 'ThrottlingException':
    case 'ExecutionLimitExceeded':
    case 'StateMachineLimitExceeded':
    case 'ActivityLimitExceeded':
    case 'ServiceQuotaExceededException':
      defaultOptions.throttling = true
      defaultOptions.httpStatusCode = 400
      break
    case 'InvalidArn':
    case 'InvalidDefinition':
    case 'InvalidExecutionInput':
    case 'InvalidName':
    case 'InvalidToken':
      defaultOptions.httpStatusCode = 400
      break
    case 'TaskTimedOut':
      defaultOptions.httpStatusCode = 400
      break
  }

  const error = createBaseAWSError(name, { ...defaultOptions, ...options })
  error.$service = 'StepFunctions'
  return error
}

// ============================================================================
// SES Errors
// ============================================================================

/**
 * Common SES error names
 */
export type SESErrorName =
  | 'MessageRejected'
  | 'MailFromDomainNotVerifiedException'
  | 'ConfigurationSetDoesNotExistException'
  | 'AccountSendingPausedException'
  | 'LimitExceededException'
  | 'NotFoundException'
  | 'TooManyRequestsException'
  | 'BadRequestException'

/**
 * Creates an SES-specific error
 */
export function createSESError(
  name: SESErrorName,
  options: CreateAWSErrorOptions = {},
): AWSError {
  const defaultOptions: Partial<CreateAWSErrorOptions> = {}

  switch (name) {
    case 'MessageRejected':
      defaultOptions.httpStatusCode = 400
      break
    case 'MailFromDomainNotVerifiedException':
      defaultOptions.httpStatusCode = 400
      break
    case 'ConfigurationSetDoesNotExistException':
    case 'NotFoundException':
      defaultOptions.httpStatusCode = 404
      break
    case 'AccountSendingPausedException':
      defaultOptions.httpStatusCode = 400
      break
    case 'LimitExceededException':
    case 'TooManyRequestsException':
      defaultOptions.throttling = true
      defaultOptions.httpStatusCode = 429
      break
    case 'BadRequestException':
      defaultOptions.httpStatusCode = 400
      break
  }

  const error = createBaseAWSError(name, { ...defaultOptions, ...options })
  error.$service = 'SES'
  return error
}

// ============================================================================
// Network Errors
// ============================================================================

/**
 * Network error codes
 */
export type NetworkErrorCode =
  | 'ECONNRESET'
  | 'ECONNREFUSED'
  | 'ETIMEDOUT'
  | 'ENETUNREACH'
  | 'ENOTFOUND'
  | 'EPIPE'
  | 'EAI_AGAIN'

/**
 * Creates a network-level error
 */
export function createNetworkError(
  code: NetworkErrorCode,
  message?: string,
): Error & { code: string } {
  const defaultMessages: Record<NetworkErrorCode, string> = {
    ECONNRESET: 'read ECONNRESET',
    ECONNREFUSED: 'connect ECONNREFUSED',
    ETIMEDOUT: 'connect ETIMEDOUT',
    ENETUNREACH: 'network unreachable',
    ENOTFOUND: 'getaddrinfo ENOTFOUND',
    EPIPE: 'write EPIPE',
    EAI_AGAIN: 'getaddrinfo EAI_AGAIN',
  }

  const error = new Error(message || defaultMessages[code]) as Error & {
    code: string
  }
  error.code = code
  return error
}

/**
 * Creates a timeout error
 */
export function createTimeoutError(message = 'Request timeout'): Error & {
  name: string
  code?: string
} {
  const error = new Error(message) as Error & { name: string; code?: string }
  error.name = 'TimeoutError'
  error.code = 'ETIMEDOUT'
  return error
}

// ============================================================================
// Generic HTTP Status Errors
// ============================================================================

/**
 * Creates an error for a specific HTTP status code
 */
export function createHttpStatusError(
  statusCode: number,
  options: {
    name?: string
    message?: string
    requestId?: string
  } = {},
): AWSError {
  const statusMessages: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    408: 'Request Timeout',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  }

  const name = options.name || statusMessages[statusCode] || 'UnknownError'
  const message = options.message || statusMessages[statusCode] || 'Error'

  return createBaseAWSError(name, {
    message,
    httpStatusCode: statusCode,
    requestId: options.requestId,
    fault: statusCode >= 500 ? 'server' : 'client',
    throttling: statusCode === 429,
  })
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Checks if an error is retriable based on AWS SDK v3 patterns
 */
export function isRetriableAWSError(error: AWSError): boolean {
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
    'SlowDown',
    'TooManyRequestsException',
  ]

  return retriableErrorNames.includes(error.name)
}

/**
 * Checks if an error is a throttling error
 */
export function isThrottlingError(error: AWSError): boolean {
  return error.$retryable?.throttling === true
}

/**
 * Checks if an error is a network error
 */
export function isNetworkError(
  error: Error & { code?: string },
): boolean {
  const networkErrorCodes: NetworkErrorCode[] = [
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENETUNREACH',
    'ENOTFOUND',
    'EPIPE',
    'EAI_AGAIN',
  ]

  if (error.code && networkErrorCodes.includes(error.code as NetworkErrorCode)) {
    return true
  }

  const message = error.message.toLowerCase()
  return (
    message.includes('socket hang up') ||
    message.includes('network error') ||
    message.includes('connection reset') ||
    message.includes('connection refused')
  )
}
