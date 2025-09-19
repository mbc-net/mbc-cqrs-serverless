import { IEvent, StepFunctionsContext } from '@mbc-cqrs-serverless/core'

export class ZipImportSfnEvent implements IEvent {
  source: string
  context: StepFunctionsContext
  input: string | any[]
  taskToken: string

  constructor(event?: Partial<ZipImportSfnEvent>) {
    Object.assign(this, event)
    this.source = event.context.Execution.Id
  }
}

// {
//   input: 'unzipped/ZIP_IMPORT_builshiru_ZIP_01K5DJFMMSSNB0FWDT1173WA7N/profile-import.csv',
//   context: {
//     Execution: {
//       Id: 'arn:aws:states:ap-northeast-1:101010101010:execution:import-zip:builshiru-zip-import-1758170971400',
//       Input: [Object],
//       Name: 'builshiru-zip-import-1758170971400',
//       RoleArn: 'arn:aws:iam::101010101010:role/DummyRole',
//       StartTime: '2025-09-18T04:49:31.405Z'
//     },
//     State: {
//       EnteredTime: '2025-09-18T04:49:31.406Z',
//       Name: 'trigger_single_csv_and_wait',
//       RetryCount: 0
//     },
//     StateMachine: {
//       Id: 'arn:aws:states:ap-northeast-1:101010101010:stateMachine:import-zip',
//       Name: 'import-zip'
//     },
//     Task: { Token: 'c9f585de-08fc-435f-9cf7-527837732d07' }
//   },
//   taskToken: 'c9f585de-08fc-435f-9cf7-527837732d07'
// }
