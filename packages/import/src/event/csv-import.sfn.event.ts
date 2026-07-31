import { IEvent, StepFunctionsContext } from '@mbc-cqrs-serverless/core'

import { CreateCsvImportDto } from '../dto/create-csv-import.dto'
import { ICsvRowImport } from '../dto/csv-import-row.interface'

/**
 * Per-batch metrics emitted by each csv_rows_handler Map iteration.
 * `totalRows` is the row count in this batch; each row is either counted in
 * `succeededRows` (including skipped-equal rows) or `failedRows`.
 */
export interface CsvBatchProcessingSummary {
  totalRows: number
  succeededRows: number
  failedRows: number
}

/** Map state output merged via `resultPath: '$.processingResults'`. */
export interface CsvFinalizeParentJobMapOutput {
  readonly processingResults?: readonly CsvBatchProcessingSummary[]
}

export class CsvImportSfnEvent implements IEvent {
  source: string
  context: StepFunctionsContext
  input: CreateCsvImportDto | ICsvRowImport | CsvFinalizeParentJobInput

  constructor(event?: Partial<CsvImportSfnEvent>) {
    Object.assign(this, event)
    this.source = event.context.Execution.Id
  }
}

export interface SfnResultWriterDetails {
  Bucket: string
  Key: string // This is the prefix path, e.g., 'sfn-results/import-csv/map-run-id/'
}

export interface SfnErrorOutput {
  Error: string
  Cause: string
}

export interface CsvFinalizeParentJobInput {
  sourceId: string
  mapOutput?: {
    MapRunArn: string
    ResultWriterDetails?: SfnResultWriterDetails
  }
  // Fallback for local serverless-offline (since it doesn't support ResultWriter)
  processingResults?: CsvBatchProcessingSummary[]

  // Present if the Map state crashed and was caught by States.ALL
  errorOutput?: SfnErrorOutput
}

// {
//   "input": {
//     "bucket": "local-bucket",
//     "key": "csv/test.csv",
//     "tableName": "policy",
//     "tenantCode": "buildshiru"
//   },
//   "context": {
//     "Execution": {
//       "Id": "arn:aws:states:ap-northeast-1:101010101010:execution:csv-import:user-1705417891631",
//       "Input": {
//         "bucket": "local-bucket",
//         "key": "csv/test.csv",
//         "tableName": "policy",
//         "tenantCode": "buildshiru"
//       },
//       "Name": "user-1705417891631",
//       "RoleArn": "arn:aws:iam::101010101010:role/DummyRole",
//       "StartTime": "2024-01-16T15:11:31.665Z"
//     },
//     "State": {
//       "EnteredTime": "2024-01-16T15:11:31.666Z",
//       "Name": "csv_loader",
//       "RetryCount": 0
//     },
//     "StateMachine": {
//       "Id": "arn:aws:states:ap-northeast-1:101010101010:stateMachine:csv-import",
//       "Name": "csv-import"
//     }
//   }
// }
