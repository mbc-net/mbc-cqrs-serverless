import {
  CommandInputModel,
  CommandPartialInputModel,
  extractInvokeContext,
  ICommandOptions,
} from '@mbc-cqrs-serverless/core'
import { Inject, Injectable, Logger } from '@nestjs/common'

import { ImportPublishMode } from '../../constant'
import { SqsBatchPayload } from '../../constant/sqs.constant'
import { ComparisonStatus } from '../../enum/comparison-status.enum'
import {
  PROCESS_STRATEGY_MAP,
  PUBLISH_MODE_MAP,
} from '../../import.module-definition'
import { IProcessStrategy } from '../../interface/processing-strategy.interface'

@Injectable()
export class CsvBatchProcessor {
  private readonly logger = new Logger(CsvBatchProcessor.name)

  constructor(
    @Inject(PROCESS_STRATEGY_MAP)
    private readonly strategyMap: Map<string, IProcessStrategy<any, any>>,
    @Inject(PUBLISH_MODE_MAP)
    private readonly publishModeMap: Map<string, ImportPublishMode>,
  ) {}

  async process(payload: SqsBatchPayload): Promise<void> {
    this.logger.debug(`Processing CSV Batch for table: ${payload.tableName}`)
    const { tableName, tenantCode, sourceId, s3Key, items } = payload

    const strategy = this.strategyMap.get(tableName)
    if (!strategy)
      throw new Error(`No process strategy registered for table: ${tableName}`)

    const publishMode =
      this.publishModeMap.get(tableName) ?? ImportPublishMode.ASYNC
    const commandService = strategy.getCommandService()
    const options: ICommandOptions = {
      invokeContext: extractInvokeContext(),
      source: sourceId,
    }

    for (const data of items) {
      const compareResult = await strategy.compare(
        { ...data, __s3Key: s3Key },
        tenantCode,
      )
      if (compareResult.status === ComparisonStatus.EQUAL) continue

      const mappedData = await strategy.map(
        compareResult.status,
        data,
        tenantCode,
        compareResult.existingData,
      )

      if (compareResult.status === ComparisonStatus.NOT_EXIST) {
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
    }
  }
}
