import { SendTaskSuccessCommand } from '@aws-sdk/client-sfn'
import {
  DetailKey,
  EventHandler,
  IEventHandler,
  KEY_SEPARATOR,
  StepFunctionService,
} from '@mbc-cqrs-serverless/core'
import { Injectable, Logger } from '@nestjs/common'

import { CSV_IMPORT_PK_PREFIX } from '../constant'
import { ImportService } from '../import.service'
import { ImportStatusQueueEvent } from './import-status.queue.event'
import { ImportStatusEnum } from '../enum'

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

    // 1. Filter for the specific event: a completed master CSV job.
    const pk = notification.pk as string
    const status = notification.content?.status

    if (
      status !== ImportStatusEnum.COMPLETED ||
      !pk?.startsWith(`${CSV_IMPORT_PK_PREFIX}${KEY_SEPARATOR}`)
    ) {
      return
    }

    this.logger.log(
      `Received completed master CSV job event for: ${notification.id}`,
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
        this.logger.log(`Found task token. Resuming Step Function.`)

        // 4. Send the success signal back to the waiting Step Function.
        // The output can be the result summary from the import job itself.
        await this.sendTaskSuccess(taskToken, importJob.result)
      } else {
        this.logger.log(
          'No task token found in import job attributes. Nothing to do.',
        )
      }
    } catch (error) {
      this.logger.error('Error in ImportStatusHandler:', error)
      throw error
    }
  }

  /**
   * Sends a success signal to a waiting Step Function task.
   * @param taskToken The unique token of the paused task.
   * @param output The JSON output to send back to the state machine.
   */
  async sendTaskSuccess(taskToken: string, output: any) {
    this.logger.log(`Sending task success for token: ${taskToken}`)
    return this.sfnService.client.send(
      new SendTaskSuccessCommand({
        taskToken: taskToken,
        output: JSON.stringify(output),
      }),
    )
  }
}
