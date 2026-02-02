/**
 * @file import.queue.event.handler.ts
 * @description This handler is the core worker for processing individual import records.
 * It listens for messages from the main SQS queue, finds the correct processing
 * strategy for the record's table type, and executes them sequentially.
 */
import {
  CommandInputModel,
  CommandPartialInputModel,
  EventHandler,
  extractInvokeContext,
  ICommandOptions,
  IEventHandler,
  KEY_SEPARATOR,
} from '@mbc-cqrs-serverless/core'
import { Inject, Logger } from '@nestjs/common'

import { CSV_IMPORT_PK_PREFIX, IMPORT_PK_PREFIX } from '../constant'
import { ImportEntity } from '../entity'
import { ComparisonStatus } from '../enum/comparison-status.enum'
import { ImportStatusEnum } from '../enum/import-status.enum'
import { parseId } from '../helpers'
import { PROCESS_STRATEGY_MAP } from '../import.module-definition'
import { ImportService } from '../import.service'
import { IProcessStrategy } from '../interface/processing-strategy.interface'
import { ImportQueueEvent } from './import.queue.event'

@EventHandler(ImportQueueEvent)
export class ImportQueueEventHandler
  implements IEventHandler<ImportQueueEvent>
{
  private readonly logger = new Logger(ImportQueueEventHandler.name)

  constructor(
    private readonly importService: ImportService,
    @Inject(PROCESS_STRATEGY_MAP)
    private readonly strategyMap: Map<string, IProcessStrategy<any, any>>,
  ) {}

  async execute(event: ImportQueueEvent): Promise<any> {
    const importEntity = event.importEvent.importEntity

    if (!importEntity.id.startsWith(`${IMPORT_PK_PREFIX}${KEY_SEPARATOR}`)) {
      this.logger.debug(
        `Skipping other type import job in main queue handler: ${importEntity.id}`,
      )
      return
    }

    await this.handleImport(event)
  }

  /**
   * Orchestrates the processing of a single import record.
   */
  async handleImport(event: ImportQueueEvent): Promise<any> {
    const importKey = event.importEvent.importKey
    const importEntity = event.importEvent.importEntity

    const { attributes, tenantCode, type: tableName } = importEntity
    this.logger.debug(
      `Processing import job ${importKey.pk}#${importKey.sk} for table: ${tableName}`,
    )

    // 1. Find the correct strategies for this import's table type
    const strategy = this.strategyMap.get(tableName)
    if (!strategy) {
      const error = new Error(
        `No import strategies registered for table: ${tableName}`,
      )
      this.logger.error(error)
      await this.importService.updateStatus(
        importKey,
        ImportStatusEnum.FAILED,
        { error: (error as Error).stack },
      )
      return
    }

    try {
      // 2. Set status to PROCESSING
      await this.importService.updateStatus(
        importKey,
        ImportStatusEnum.PROCESSING,
      )

      // 3. Execute all registered strategies in sequence for this record
      await this.executeStrategy(strategy, attributes, tenantCode, importEntity)

      // // 4. Finalize the import status as COMPLETED
      // await this.importService.updateStatus(
      //   importKey,
      //   ImportStatusEnum.COMPLETED,
      //   { result },
      // )
      // this.logger.log(
      //   `Successfully completed import job: ${importKey.pk}#${importKey.sk}`,
      // )
    } catch (error) {
      // 5. Handle any errors during processing
      // 5. 処理中のエラーをハンドリング
      this.logger.error(
        `Failed to process import job: ${importKey.pk}#${importKey.sk}`,
        error,
      )
      await Promise.all([
        this.importService.updateStatus(importKey, ImportStatusEnum.FAILED, {
          error: {
            message: (error as Error).message,
            stack: (error as Error).stack,
          },
        }),
        this.importService.publishAlarm(event, (error as Error).stack),
      ])

      // 6. Increment parent job counters to track failure and trigger completion check
      // 6. 親ジョブのカウンターを更新し、完了チェックをトリガー
      const skParts = importEntity.sk.split(KEY_SEPARATOR)
      const parentId = skParts.slice(0, -1).join(KEY_SEPARATOR)

      if (parentId.startsWith(CSV_IMPORT_PK_PREFIX)) {
        this.logger.debug(
          `Updating parent job counter for FAILED child: ${importEntity.id}`,
        )
        const parentKey = parseId(parentId)
        // Mark as failed in parent job counters
        // 親ジョブのカウンターで失敗としてマーク
        await this.importService.incrementParentJobCounters(parentKey, false)
      }

      // Don't rethrow - the error has been handled and logged
      // 再スローしない - エラーは処理・ログ済み
    }
  }

  /**
   * Executes the full lifecycle (compare, map, save) for a single strategy.
   * @returns The result of the create/update operation or a status message.
   */
  private async executeStrategy(
    strategy: IProcessStrategy<any, any>,
    attributes: Record<string, any>,
    tenantCode: string,
    importEntity: ImportEntity,
  ): Promise<void> {
    // 1. Determine if there are changes
    const compareResult = await strategy.compare(attributes, tenantCode)
    const importKey = {
      pk: importEntity.pk,
      sk: importEntity.sk,
    }

    if (compareResult.status === ComparisonStatus.EQUAL) {
      this.logger.log(
        `No changes for import job ${importEntity.id}, marking as completed.`,
      )
      await this.importService.updateStatus(
        importKey,
        ImportStatusEnum.COMPLETED,
        { result: { status: 'EQUAL', message: 'No changes detected.' } },
      )
      const skParts = importEntity.sk.split(KEY_SEPARATOR)
      const parentId = skParts.slice(0, -1).join(KEY_SEPARATOR)

      if (parentId.startsWith(CSV_IMPORT_PK_PREFIX)) {
        this.logger.debug(
          `Updating parent job counter for EQUAL status child: ${importEntity.id}`,
        )
        const parentKey = parseId(parentId)
        // Since the status is EQUAL, the child "succeeded" in its processing.
        await this.importService.incrementParentJobCounters(parentKey, true)
      }
      return // Stop execution for this case
    }

    // 2. Map the attributes to the correct CommandService input model
    // The strategy now handles the logic of building the payload.
    const mappedData = await strategy.map(
      compareResult.status,
      attributes,
      tenantCode,
      compareResult.existingData,
    )

    const commandService = strategy.getCommandService()
    let result: any

    // 3. Execute the appropriate command
    const invokeContext = extractInvokeContext()
    const options: ICommandOptions = {
      invokeContext,
      source: importEntity.id,
    }
    if (compareResult.status === ComparisonStatus.NOT_EXIST) {
      result = await commandService.publishAsync(
        mappedData as CommandInputModel,
        options,
      )
      // 4. Finalize the import status as COMPLETED
      await this.importService.updateStatus(
        importKey,
        ImportStatusEnum.PROCESSING,
        { result: result },
      )
      this.logger.log(
        `Successfully completed import job: ${importKey.pk}#${importKey.sk}`,
      )
    } else {
      result = await commandService.publishPartialUpdateAsync(
        mappedData as CommandPartialInputModel,
        options,
      )
      await this.importService.updateStatus(
        importKey,
        ImportStatusEnum.PROCESSING,
        { result: result },
      )
    }
  }
}
