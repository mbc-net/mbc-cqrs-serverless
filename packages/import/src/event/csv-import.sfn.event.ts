import { IEvent, StepFunctionsContext } from '@mbc-cqrs-serverless/core'

import { CreateCsvImportDto } from '../dto/create-csv-import.dto'
import { ICsvRowImport } from '../dto/csv-import-row.interface'

export class CsvImportSfnEvent implements IEvent {
  source: string
  context: StepFunctionsContext
  input: CreateCsvImportDto | ICsvRowImport

  constructor(event?: Partial<CsvImportSfnEvent>) {
    Object.assign(this, event)
    this.source = event.context.Execution.Id
  }
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
