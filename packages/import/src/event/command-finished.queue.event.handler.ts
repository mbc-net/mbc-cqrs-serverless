import {
  CommandStatus,
  DataSyncCommandSfnName,
  EventHandler,
  IEventHandler,
  KEY_SEPARATOR,
  NotificationEvent,
} from '@mbc-cqrs-serverless/core'
import { Logger } from '@nestjs/common'

import { CSV_IMPORT_PK_PREFIX, IMPORT_PK_PREFIX } from '../constant'
import { ImportStatusEnum } from '../enum'
import { parseId } from '../helpers'
import { ImportService } from '../import.service'

// Interface for the expected structure of the parsed event body.
interface CommandStatusNotification {
  action: 'command-status'
  content: {
    status: string
    source?: string
    result?: Record<string, any>
    error?: Record<string, any>
  }
}

// Constants for magic strings to improve maintainability.
const ACTION_COMMAND_STATUS = 'command-status'

@EventHandler(NotificationEvent)
export class CommandFinishedHandler
  implements IEventHandler<NotificationEvent>
{
  private readonly logger = new Logger(CommandFinishedHandler.name)

  constructor(private readonly importService: ImportService) {}

  /**
   * Executes the handler logic when a NotificationEvent is received.
   * This method orchestrates the validation, parsing, and processing of command status updates.
   * @param {NotificationEvent} event The incoming event.
   */
  async execute(event: NotificationEvent): Promise<any> {
    this.logger.debug('Processing command notification event...')

    try {
      // 1. Parse and validate the event payload.
      const payload = this.parseAndValidatePayload(event.body)
      if (!payload) {
        return
      }

      const { source, status, result, error } = payload.content

      // 2. Ensure the notification is for a relevant import job.
      if (!this.isImportSource(source)) {
        this.logger.debug(
          `Ignoring notification from non-import source: ${source}`,
        )
        return
      }

      // 3. Map the command status to a final import status (e.g., COMPLETED, FAILED).
      const newStatus = this.mapCommandStatusToImportStatus(status)
      if (!newStatus) {
        this.logger.debug(
          `Ignoring intermediate command status '${status}' for source ${source}`,
        )
        return
      }

      // 4. Parse the source string to get the database key.
      const importKey = parseId(source)
      if (!importKey) {
        return
      }

      // 5. Update the import entity with the new status and result/error data.
      this.logger.log(`Updating import job ${source} to status ${newStatus}`)
      await this.importService.updateStatus(importKey, newStatus, {
        result,
        error,
      })

      const skParts = importKey.sk.split(KEY_SEPARATOR)
      const parentId = skParts.slice(0, -1).join(KEY_SEPARATOR) // Everything except the last part (the child's own ULID)

      if (parentId.startsWith(CSV_IMPORT_PK_PREFIX)) {
        const parentKey = parseId(parentId)
        const childSucceeded = newStatus === ImportStatusEnum.COMPLETED
        // This call will handle incrementing and finalizing the parent job.
        await this.importService.incrementParentJobCounters(
          parentKey,
          childSucceeded,
        )
      }
    } catch (error) {
      this.logger.error('Failed to process command notification event', error)
      throw error
    }
  }

  /**
   * Parses the JSON event body and validates its basic structure.
   * @param {string} body The raw event body string.
   * @returns {CommandStatusNotification | null} The parsed payload or null if invalid.
   */
  private parseAndValidatePayload(
    body: string,
  ): CommandStatusNotification | null {
    try {
      const payload = JSON.parse(body) as CommandStatusNotification

      if (
        payload.action !== ACTION_COMMAND_STATUS ||
        !payload.content?.source
      ) {
        this.logger.debug(
          'Ignoring notification: not a valid command status event for import.',
        )
        return null
      }

      return payload
    } catch (error) {
      this.logger.error('Failed to parse event body as JSON', body)
      return null
    }
  }

  /**
   * Checks if the event source is an import job.
   * @param {string} source The source identifier from the event.
   * @returns {boolean} True if the source is for an import job.
   */
  private isImportSource(source: string = ''): boolean {
    return source.startsWith(`${IMPORT_PK_PREFIX}${KEY_SEPARATOR}`)
  }

  /**
   * Maps a raw command status string to the corresponding ImportStatusEnum.
   * @param {string} commandStatus The status string from the command.
   * @returns {ImportStatusEnum | null} The mapped status or null if it's not a final status.
   */
  private mapCommandStatusToImportStatus(
    commandStatus: string,
  ): ImportStatusEnum | null {
    switch (commandStatus) {
      case `${DataSyncCommandSfnName.FINISH}:${CommandStatus.STATUS_FINISHED}`:
        return ImportStatusEnum.COMPLETED
      case `${DataSyncCommandSfnName.FINISH}:${CommandStatus.STATUS_FAILED}`:
        return ImportStatusEnum.FAILED
      default:
        return null // Not a final status we need to handle.
    }
  }
}
