export * from './datetime'
export * from './event-type'
export * from './key'
export * from './object'
export * from './serializer'
export * from './source'

// Re-export serialization helpers for convenience
export { deserializeToInternal, serializeToExternal } from './serializer'

export const IS_LAMBDA_RUNNING =
  !!process.env.AWS_LAMBDA_FUNCTION_NAME &&
  !!process.env.AWS_LAMBDA_FUNCTION_VERSION &&
  !!process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE
