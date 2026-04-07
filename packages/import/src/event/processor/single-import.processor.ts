import {
  CommandInputModel,
  CommandPartialInputModel,
  extractInvokeContext,
  ICommandOptions,
  KEY_SEPARATOR,
} from '@mbc-cqrs-serverless/core'
import { Inject, Injectable, Logger } from '@nestjs/common'

import {
  CSV_IMPORT_PK_PREFIX,
  IMPORT_PK_PREFIX,
  ImportPublishMode,
} from '../../constant'
import { ImportEntity } from '../../entity'
import { ComparisonStatus } from '../../enum/comparison-status.enum'
import { ImportStatusEnum } from '../../enum/import-status.enum'
import { parseId } from '../../helpers'
import {
  PROCESS_STRATEGY_MAP,
  PUBLISH_MODE_MAP,
} from '../../import.module-definition'
import { ImportService } from '../../import.service'
import { IProcessStrategy } from '../../interface/processing-strategy.interface'

@Injectable()
export class SingleImportProcessor {
  private readonly logger = new Logger(SingleImportProcessor.name)

  constructor(
    private readonly importService: ImportService,
    @Inject(PROCESS_STRATEGY_MAP)
    private readonly strategyMap: Map<string, IProcessStrategy<any, any>>,
    @Inject(PUBLISH_MODE_MAP)
    private readonly publishModeMap: Map<string, ImportPublishMode>,
  ) {}

  async process(payload: any): Promise<void> {
    const importEntity = payload.importEntity

    // Guard clause: Ensure this is actually an import job we care about
    if (!importEntity?.id?.startsWith(`${IMPORT_PK_PREFIX}${KEY_SEPARATOR}`)) {
      this.logger.debug(`Skipping other type import job: ${importEntity?.id}`)
      return
    }

    const importKey = payload.importKey
    const { attributes, tenantCode, type: tableName } = importEntity

    this.logger.debug(
      `Processing single import job ${importKey.pk}#${importKey.sk} for table: ${tableName}`,
    )

    const strategy = this.strategyMap.get(tableName)
    if (!strategy) {
      const error = new Error(
        `No import strategies registered for table: ${tableName}`,
      )
      this.logger.error(error)
      await this.importService.updateStatus(
        importKey,
        ImportStatusEnum.FAILED,
        {
          error: error.stack,
        },
      )
      return
    }

    try {
      await this.importService.updateStatus(
        importKey,
        ImportStatusEnum.PROCESSING,
      )
      await this.executeStrategy(strategy, attributes, tenantCode, importEntity)
    } catch (error) {
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
        this.importService.publishAlarm(payload, (error as Error).stack),
      ])

      // If this single import was part of a larger parent job, inform the parent it failed
      const skParts = importEntity.sk.split(KEY_SEPARATOR)
      const parentId = skParts.slice(0, -1).join(KEY_SEPARATOR)

      if (parentId.startsWith(CSV_IMPORT_PK_PREFIX)) {
        const parentKey = parseId(parentId)
        await this.importService.incrementParentJobCounters(parentKey, false)
      }
    }
  }

  private async executeStrategy(
    strategy: IProcessStrategy<any, any>,
    attributes: Record<string, any>,
    tenantCode: string,
    importEntity: ImportEntity,
  ): Promise<void> {
    const compareResult = await strategy.compare(attributes, tenantCode)
    const importKey = { pk: importEntity.pk, sk: importEntity.sk }

    // SCENARIO 1: Data is identical, no update needed
    if (compareResult.status === ComparisonStatus.EQUAL) {
      this.logger.debug(
        `No changes for import job ${importEntity.id}, marking as completed.`,
      )
      await this.importService.updateStatus(
        importKey,
        ImportStatusEnum.COMPLETED,
        {
          result: { status: 'EQUAL', message: 'No changes detected.' },
        },
      )

      const skParts = importEntity.sk.split(KEY_SEPARATOR)
      const parentId = skParts.slice(0, -1).join(KEY_SEPARATOR)

      if (parentId.startsWith(CSV_IMPORT_PK_PREFIX)) {
        const parentKey = parseId(parentId)
        await this.importService.incrementParentJobCounters(parentKey, true)
      }
      return
    }

    // SCENARIO 2: Data is new or changed, requires mapping and publishing
    const mappedData = await strategy.map(
      compareResult.status,
      attributes,
      tenantCode,
      compareResult.existingData,
    )

    const commandService = strategy.getCommandService()
    const { type: tableName } = importEntity
    const publishMode =
      this.publishModeMap.get(tableName) ?? ImportPublishMode.ASYNC

    const invokeContext = extractInvokeContext()
    const options: ICommandOptions = { invokeContext, source: importEntity.id }

    let result: any

    if (compareResult.status === ComparisonStatus.NOT_EXIST) {
      // Create new record
      result =
        publishMode === ImportPublishMode.SYNC
          ? await commandService.publishSync(
              mappedData as CommandInputModel,
              options,
            )
          : await commandService.publishAsync(
              mappedData as CommandInputModel,
              options,
            )
    } else {
      // Update existing record
      result =
        publishMode === ImportPublishMode.SYNC
          ? await commandService.publishPartialUpdateSync(
              mappedData as CommandPartialInputModel,
              options,
            )
          : await commandService.publishPartialUpdateAsync(
              mappedData as CommandPartialInputModel,
              options,
            )
    }

    await this.importService.updateStatus(
      importKey,
      ImportStatusEnum.PROCESSING,
      { result },
    )
  }
}
