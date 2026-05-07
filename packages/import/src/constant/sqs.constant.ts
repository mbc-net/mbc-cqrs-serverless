import { ImportEvent } from '../event/import.event'

export const ACTION_CSV_BATCH_PROCESS = 'csv-batch-process'
export const ACTION_SINGLE_IMPORT_PROCESS = 'single-import-process'

/** SQS hard limits */
export const SQS_MAX_BATCH_SIZE = 10
export const SQS_MAX_MESSAGE_BYTES = 256 * 1024
export const SQS_MESSAGE_BYTE_OVERHEAD = 1024
export const SQS_SAFE_BODY_BYTES =
  SQS_MAX_MESSAGE_BYTES - SQS_MESSAGE_BYTE_OVERHEAD
export const SQS_PAYLOAD_ENVELOPE_BYTES = 300

export interface SqsBatchPayload {
  action: string
  tableName: string
  tenantCode: string
  sourceId: string
  s3Key: string
  items: any[]
}

export interface SqsSinglePayload extends ImportEvent {
  action: string
}
