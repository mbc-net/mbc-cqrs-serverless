/**
 * How import publishes commands to CommandService.
 * SYNC: execute immediately (bypasses downstream Step Functions).
 * ASYNC: default pipeline (e.g. Step Functions).
 */
export enum ImportPublishMode {
  SYNC = 'SYNC',
  ASYNC = 'ASYNC',
}
