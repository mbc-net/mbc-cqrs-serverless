import { DetailKey } from '@mbc-cqrs-serverless/core'

import { ImportStatusEnum } from '../enum'
import { ZipImportSfnEvent } from '../event/zip-import.sfn.event'

// context: {
//   event: ZipImportSfnEvent {
//     input: [ [Object] ],
//     context: { Execution: [Object], State: [Object], StateMachine: [Object] },
//     source: 'arn:aws:states:ap-northeast-1:101010101010:execution:import-zip:builshiru-zip-import-1768379462736'
//   },
//   masterJobKey: { sk: 'ZIP#01KEXT1YS584YJJKRW30V5S0XZ', pk: 'ZIP_IMPORT#builshiru' },
//   results: { totalRows: 1, processedRows: 1, failedRows: 0 },
//   status: 'COMPLETED',
//   executionInput: {
//     masterJobKey: {
//       sk: 'ZIP#01KEXT1YS584YJJKRW30V5S0XZ',
//       pk: 'ZIP_IMPORT#builshiru'
//     },
//     sortedS3Keys: [ 'upload/milai/building/2025102817301_UC_tatemono.csv' ],
//     parameters: {
//       bucket: 'local-bucket',
//       tenantCode: 'builshiru',
//       tableName: 'building'
//     }
//   }
// }

/**
 * Context passed to ZIP finalization hooks containing all relevant job information.
 */
export interface ZipFinalizationContext {
  /** The original Step Function event */
  event: ZipImportSfnEvent
  /** The key of the master ZIP job */
  masterJobKey: DetailKey
  /** Aggregated results from all CSV files */
  results: {
    totalRows: number
    processedRows: number
    failedRows: number
  }
  /** Final status of the job */
  status: ImportStatusEnum
  /** The original execution input from Step Functions */
  executionInput: any
}

/**
 * Interface for custom hooks that execute after ZIP import processing completes.
 * Implementations can perform post-processing tasks like moving files to backup,
 * sending notifications, or updating external systems.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class BackupToS3Hook implements IZipFinalizationHook {
 *   constructor(private readonly s3Service: S3Service) {}
 *
 *   async execute(context: ZipFinalizationContext): Promise<void> {
 *     const { executionInput } = context
 *     const { bucket, key } = executionInput.parameters
 *
 *     // Move file to backup location
 *     const backupKey = `backup/${key}`
 *     await this.s3Service.copyObject({
 *       sourceBucket: bucket,
 *       sourceKey: key,
 *       destinationBucket: bucket,
 *       destinationKey: backupKey,
 *     })
 *   }
 * }
 * ```
 */
export interface IZipFinalizationHook {
  /**
   * Executes custom logic after ZIP import completes.
   * Hooks run in parallel and errors are logged without failing the job.
   *
   * @param context - Contains event data, masterJobKey, and aggregated results
   * @returns Promise that resolves when hook completes
   */
  execute(context: ZipFinalizationContext): Promise<void>
}
