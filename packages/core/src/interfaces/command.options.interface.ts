import { IInvoke } from '../context'

/**
 * Options passed to command service methods.
 * Contains context information needed for command processing.
 *
 * @example
 * await commandService.publishAsync(input, {
 *   source: 'POST /api/orders',
 *   invokeContext: { event, context }
 * })
 */
export interface ICommandOptions {
  /** Origin of the command (e.g., 'POST /api/orders', 'SQS', 'StepFunction') */
  source?: string
  /** Unique request ID for tracing - auto-generated if not provided */
  requestId?: string
  /** Lambda invoke context containing event and AWS context */
  invokeContext: IInvoke
}
