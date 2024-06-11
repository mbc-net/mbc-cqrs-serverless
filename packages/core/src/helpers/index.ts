export * from './datetime'
export * from './event-type'
export * from './key'
export * from './object'
export * from './source'

export const IS_LAMBDA_RUNNING =
  !!process.env.AWS_LAMBDA_FUNCTION_NAME &&
  !!process.env.AWS_LAMBDA_FUNCTION_VERSION &&
  !!process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE
