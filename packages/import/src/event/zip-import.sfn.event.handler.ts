import {
  DetailKey,
  EventHandler,
  IEventHandler,
} from '@mbc-cqrs-serverless/core'
import { Inject, Injectable, Logger } from '@nestjs/common'

import { CreateCsvImportDto } from '../dto'
import { ImportStatusEnum, ProcessingMode } from '../enum'
import { ZIP_FINALIZATION_HOOKS } from '../import.module-definition'
import { ImportService } from '../import.service'
import {
  IZipFinalizationHook,
  ZipFinalizationContext,
} from '../interface/zip-finalization-hook.interface'
import { ZipImportSfnEvent } from './zip-import.sfn.event'

@Injectable()
@EventHandler(ZipImportSfnEvent)
export class ZipImportSfnEventHandler
  implements IEventHandler<ZipImportSfnEvent>
{
  private readonly logger: Logger = new Logger(ZipImportSfnEventHandler.name)

  constructor(
    private readonly importService: ImportService,
    @Inject(ZIP_FINALIZATION_HOOKS)
    private readonly finalizationHooks: IZipFinalizationHook[],
  ) {}

  async execute(event: ZipImportSfnEvent): Promise<any> {
    const stateName = event.context.State.Name
    this.logger.log(`Executing state: ${stateName} for Zip SFN`)

    if (stateName === 'trigger_single_csv_and_wait') {
      return this.triggerSingleCsvJob(event)
    }

    if (stateName === 'finalize_zip_job') {
      return this.finalizeZipMasterJob(event)
    }

    this.logger.warn(
      `Unknown state name in ZipImportSfnEventHandler: ${stateName}`,
    )
  }

  /**
   * Handles the trigger_single_csv_and_wait state from the orchestrator.
   * It extracts the tableName from the filename and starts a new CSV import job,
   * passing along the taskToken so the orchestrator can be notified upon completion.
   */
  private async triggerSingleCsvJob(event: ZipImportSfnEvent) {
    const s3Key = (event.input as any)?.s3Key || event.input
    const { taskToken } = event
    const { masterJobKey, parameters } = event.context.Execution.Input

    this.logger.log(`Triggering CSV job for file: ${s3Key}`)

    let tableName = parameters.tableName
    if (!tableName) {
      // Use a regex to extract the table name from the filename.
      // Convention: yyyymmddhhMMss-{table name}.csv
      const match = s3Key.match(/\d{14}-(.+)\.csv$/)
      if (!match || !match[1]) {
        throw new Error(
          `Could not parse tableName from filename: ${s3Key}. Expected format: yyyymmddhhMMss-{tableName}.csv`,
        )
      }
      tableName = match[1]
    }

    const dto: CreateCsvImportDto = {
      processingMode: ProcessingMode.STEP_FUNCTION,
      bucket: parameters.bucket,
      key: s3Key,
      tenantCode: parameters.tenantCode,
      tableName: tableName,
    }

    await this.importService.createCsvJobWithTaskToken(
      dto,
      taskToken,
      masterJobKey,
    )

    this.logger.log(
      `Successfully created CSV job for ${tableName} with task token.`,
    )
  }

  /**
   * Handles the final state of the orchestrator.
   * It aggregates the results from all processed CSV files and sets the final
   * status on the original ZIP_MASTER_JOB.
   */
  private async finalizeZipMasterJob(event: ZipImportSfnEvent) {
    const resultsFromMapState =
      ((event.input as any)?.processingResults as any[]) ||
      (event.input as any[]) // This will be an array of results
    const { masterJobKey } = event.context.Execution.Input

    this.logger.log(
      `Finalizing ZIP master job: ${masterJobKey.pk}#${masterJobKey.sk}`,
    )
    this.logger.debug('Aggregated results:', resultsFromMapState)

    // Aggregate the results from each CSV file's processing.
    const finalSummary = resultsFromMapState.reduce(
      (acc, result) => {
        const res = result?.result || result || {}
        acc.totalRows += res.total || res.totalRows || 0
        acc.processedRows += res.succeeded || res.processedRows || 0
        acc.failedRows += res.failed || res.failedRows || 0
        return acc
      },
      { totalRows: 0, processedRows: 0, failedRows: 0 },
    )
    const finalStatus = ImportStatusEnum.COMPLETED

    // Execute finalization hooks in parallel
    await this.executeFinalizationHooks(
      event,
      masterJobKey,
      finalSummary,
      finalStatus,
    )

    await this.importService.updateStatus(masterJobKey, finalStatus, {
      result: finalSummary,
    })

    this.logger.log(
      `Successfully finalized ZIP master job ${masterJobKey.pk}#${masterJobKey.sk} with status ${finalStatus}`,
    )
  }

  /**
   * Executes all registered ZIP finalization hooks in parallel.
   * Errors are logged but do not affect job completion status.
   */
  private async executeFinalizationHooks(
    event: ZipImportSfnEvent,
    masterJobKey: DetailKey,
    results: { totalRows: number; processedRows: number; failedRows: number },
    status: ImportStatusEnum,
  ): Promise<void> {
    if (!this.finalizationHooks || this.finalizationHooks.length === 0) {
      this.logger.debug('No ZIP finalization hooks registered')
      return
    }

    this.logger.log(
      `Executing ${this.finalizationHooks.length} ZIP finalization hook(s)`,
    )

    const context: ZipFinalizationContext = {
      event,
      masterJobKey,
      results,
      status,
      executionInput: event.context.Execution.Input,
    }

    // Execute all hooks in parallel with error isolation
    const hookPromises = this.finalizationHooks.map(async (hook, index) => {
      try {
        this.logger.log(
          `Executing ZIP finalization hook ${index + 1}/${this.finalizationHooks.length}`,
        )
        await hook.execute(context)
        this.logger.log(
          `ZIP finalization hook ${index + 1} completed successfully`,
        )
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        this.logger.error(
          `ZIP finalization hook ${index + 1} failed: ${errorMessage}`,
          errorStack,
        )
        // Continue execution - don't propagate error
      }
    })

    await Promise.allSettled(hookPromises)
    this.logger.log(`All ZIP finalization hooks completed`)
  }
}
