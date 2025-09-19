// event/csv-job.event.handler.ts (Refactored)
import {
  EventHandler,
  IEventHandler,
  KEY_SEPARATOR,
  StepFunctionService,
} from '@mbc-cqrs-serverless/core'
import { Inject, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { CSV_IMPORT_PK_PREFIX } from '../constant'
import { CreateCsvImportDto } from '../dto/create-csv-import.dto'
import { ImportStatusEnum } from '../enum/import-status.enum'
import { IMPORT_STRATEGY_MAP } from '../import.module-definition'
import { ImportService } from '../import.service'
import { IImportStrategy } from '../interface'
import { ImportQueueEvent } from './import.queue.event'

@EventHandler(ImportQueueEvent)
export class CsvImportQueueEventHandler
  implements IEventHandler<ImportQueueEvent>
{
  private readonly logger = new Logger(CsvImportQueueEventHandler.name)
  private readonly csvImportArn: string

  constructor(
    private readonly configService: ConfigService,
    private readonly sfnService: StepFunctionService,
    private readonly importService: ImportService,
    @Inject(IMPORT_STRATEGY_MAP)
    private readonly importStrategyMap: Map<string, IImportStrategy<any, any>>,
  ) {
    this.csvImportArn = this.configService.get<string>('SFN_IMPORT_CSV_ARN')
  }

  async execute(event: ImportQueueEvent): Promise<any> {
    const importEntity = event.importEvent.importEntity

    // This handler ONLY acts on master csv jobs and ignores all other event types.
    if (
      !importEntity.id.startsWith(`${CSV_IMPORT_PK_PREFIX}${KEY_SEPARATOR}`)
    ) {
      return
    }

    const importKey = event.importEvent.importKey
    const { key, tableName, tenantCode } =
      importEntity.attributes as CreateCsvImportDto
    this.logger.log(
      `Received master CSV job from queue: ${importEntity.id} for file ${key}`,
    )

    try {
      await this.importService.updateStatus(
        importKey,
        ImportStatusEnum.PROCESSING,
      )

      // 1. Find the custom CSV mapper for the target table.
      const mapper = this.importStrategyMap.get(tableName)
      if (!mapper) {
        throw new Error(`No CSV mapping strategy found for table: ${tableName}`)
      }

      await this.sfnService.startExecution(
        this.csvImportArn,
        {
          ...importEntity.attributes,
          sourceId: importEntity.id,
        },
        `${tenantCode}-${tableName}-${Date.now()}`,
      )

      this.logger.log(
        `Started Step Function execution for master job ${importEntity.id}`,
      )
      // The master job's status will now be updated by the Step Function itself upon completion/failure.
    } catch (error) {
      this.logger.error(
        `Failed to start Step Function for master job ${importEntity.id}`,
        error,
      )
      // If starting the SFN fails, update the master job to FAILED status.
      await this.importService.updateStatus(
        importKey,
        ImportStatusEnum.FAILED,
        {
          error: {
            message: `Failed to start Step Function: ${(error as Error).message}`,
          },
        },
      )
      throw error
    }
  }
}
