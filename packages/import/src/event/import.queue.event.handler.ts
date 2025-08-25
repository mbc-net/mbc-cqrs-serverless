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
} from '@mbc-cqrs-serverless/core'
import { Inject, Logger } from '@nestjs/common'

import { ComparisonStatus } from '../enum/comparison-status.enum'
import { ImportStatusEnum } from '../enum/import-status.enum'
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

    // This handler processes individual records, so it must ignore the master CSV jobs.
    // Master jobs are handled exclusively by the CsvImportQueueEventHandler.
    if (importEntity.type === 'CSV_MASTER_JOB') {
      this.logger.debug(
        `Skipping CSV_MASTER_JOB in main queue handler: ${importEntity.id}`,
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
    const {
      attributes,
      tenantCode,
      type: tableName,
    } = event.importEvent.importEntity
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
      const result = await this.executeStrategy(
        strategy,
        attributes,
        tenantCode,
      )

      // 4. Finalize the import status as COMPLETED
      await this.importService.updateStatus(
        importKey,
        ImportStatusEnum.COMPLETED,
        { result },
      )
      this.logger.log(
        `Successfully completed import job: ${importKey.pk}#${importKey.sk}`,
      )
    } catch (error) {
      // 5. Handle any errors during processing
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
      throw error
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
  ): Promise<any> {
    // 1. Determine if there are changes
    const compareResult = await strategy.compare(attributes, tenantCode)

    if (compareResult.status === ComparisonStatus.EQUAL) {
      return { status: 'EQUAL', message: 'No changes detected.' }
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
    let finalResult: any

    // 3. Execute the appropriate command
    const invokeContext = extractInvokeContext()
    const options: ICommandOptions = {
      invokeContext,
    }
    if (compareResult.status === ComparisonStatus.NOT_EXIST) {
      finalResult = await commandService.publishAsync(
        mappedData as CommandInputModel,
        options,
      )
    } else {
      finalResult = await commandService.publishPartialUpdateAsync(
        mappedData as CommandPartialInputModel,
        options,
      )
    }

    return finalResult
  }
}
