import {
  SendTaskFailureCommand,
  SendTaskSuccessCommand,
} from '@aws-sdk/client-sfn'
import {
  DetailKey,
  EventHandler,
  IEventHandler,
  KEY_SEPARATOR,
  StepFunctionService,
} from '@mbc-cqrs-serverless/core'
import { Injectable, Logger } from '@nestjs/common'

import { CSV_IMPORT_PK_PREFIX } from '../constant'
import { ImportStatusEnum } from '../enum'
import { ImportService } from '../import.service'
import { ImportStatusQueueEvent } from './import-status.queue.event'

@Injectable()
@EventHandler(ImportStatusQueueEvent)
export class ImportStatusHandler
  implements IEventHandler<ImportStatusQueueEvent>
{
  private readonly logger = new Logger(ImportStatusHandler.name)

  constructor(
    private readonly importService: ImportService,
    private readonly sfnService: StepFunctionService,
  ) {}

  async execute(event: ImportStatusQueueEvent): Promise<void> {
    const notification = JSON.parse(event.body)

    // 1. Filter for specific events: completed or failed master CSV jobs.
    const pk = notification.pk as string
    const status = notification.content?.status

    // Only process COMPLETED or FAILED status for CSV_IMPORT jobs
    const isTerminalStatus =
      status === ImportStatusEnum.COMPLETED ||
      status === ImportStatusEnum.FAILED
    const isCsvImportJob = pk?.startsWith(
      `${CSV_IMPORT_PK_PREFIX}${KEY_SEPARATOR}`,
    )

    if (!isTerminalStatus || !isCsvImportJob) {
      return
    }

    this.logger.debug(
      `Received ${status} master CSV job event for: ${notification.id}`,
    )

    try {
      // 2. Get the full import job entity from DynamoDB.
      const importKey: DetailKey = { pk: notification.pk, sk: notification.sk }
      const importJob = await this.importService.getImportByKey(importKey)

      if (!importJob) {
        this.logger.warn(`Could not find import job for key:`, importKey)
        return
      }

      // 3. Check if a taskToken was saved in its attributes.
      const taskToken = importJob.attributes?.taskToken
      if (taskToken) {
        this.logger.debug(
          status === ImportStatusEnum.FAILED
            ? 'Found task token. Sending SendTaskSuccess with importJobStatus FAILED (ZIP orchestrator).'
            : `Found task token. Sending ${status} signal to Step Function.`,
        )

        // 4. Send the callback so the ZIP orchestrator Map can continue (option B).
        // Always use SendTaskSuccess; include importJobStatus when the CSV master job failed
        // so finalize_zip_job can mark the ZIP FAILED after aggregating all files.
        if (status === ImportStatusEnum.COMPLETED) {
          await this.sendTaskSuccess(taskToken, importJob.result)
        } else if (status === ImportStatusEnum.FAILED) {
          await this.sendTaskSuccess(
            taskToken,
            this.buildZipOrchestratorFailureOutput(importJob.result),
          )
        }
      } else {
        this.logger.debug(
          'No task token found in import job attributes. Nothing to do.',
        )
      }
    } catch (error) {
      this.logger.error('Error in ImportStatusHandler:', error)
      throw error
    }
  }

  /**
   * Merges the import job result with FAILED status for ZIP orchestrator callbacks.
   */
  private buildZipOrchestratorFailureOutput(
    result: unknown,
  ): Record<string, unknown> {
    if (
      result != null &&
      typeof result === 'object' &&
      !Array.isArray(result)
    ) {
      return {
        ...(result as Record<string, unknown>),
        importJobStatus: ImportStatusEnum.FAILED,
      }
    }
    return { result, importJobStatus: ImportStatusEnum.FAILED }
  }

  /**
   * Sends a success signal to a waiting Step Function task.
   * @param taskToken The unique token of the paused task.
   * @param output The JSON output to send back to the state machine.
   */
  async sendTaskSuccess(taskToken: string, output: any) {
    this.logger.debug(`Sending task success for token: ${taskToken}`)
    return this.sfnService.client.send(
      new SendTaskSuccessCommand({
        taskToken: taskToken,
        output: JSON.stringify(output),
      }),
    )
  }

  /**
   * Sends a failure signal to a waiting Step Function task.
   *
   * NOTE: As of this PR, this method is no longer called from execute().
   * The ZIP orchestrator uses SendTaskSuccess with importJobStatus instead (Option B),
   * so the Map state can continue processing remaining files even when one CSV fails.
   * Kept public for potential use cases outside ZIP orchestration.
   *
   * @param taskToken The unique token of the paused task.
   * @param error The error code to send back to the state machine.
   * @param cause The detailed cause of the failure (will be JSON stringified).
   */
  async sendTaskFailure(taskToken: string, error: string, cause: any) {
    this.logger.debug(`Sending task failure for token: ${taskToken}`)
    return this.sfnService.client.send(
      new SendTaskFailureCommand({
        taskToken: taskToken,
        error: error,
        cause: JSON.stringify(cause),
      }),
    )
  }
}
