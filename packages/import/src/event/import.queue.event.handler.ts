import { EventHandler, IEventHandler } from '@mbc-cqrs-serverless/core'
import { Logger } from '@nestjs/common'

import { ImportQueueEvent } from './import.queue.event'
import { CsvBatchProcessor } from './processor/csv-batch.processor'
import { SingleImportProcessor } from './processor/single-import.processor'

@EventHandler(ImportQueueEvent)
export class ImportQueueEventHandler
  implements IEventHandler<ImportQueueEvent>
{
  private readonly logger = new Logger(ImportQueueEventHandler.name)

  constructor(
    private readonly csvBatchProcessor: CsvBatchProcessor,
    private readonly singleImportProcessor: SingleImportProcessor,
  ) {}

  async execute(event: ImportQueueEvent): Promise<void> {
    try {
      if (event.isCsvBatch) {
        await this.csvBatchProcessor.process(event.payload)
      } else {
        // Fallback to single import (or add more if/else for ZIP)
        await this.singleImportProcessor.process(event.importEvent)
      }
    } catch (error) {
      this.logger.error(
        `Failed to process message in ImportQueueEventHandler. Event Payload: ${JSON.stringify(event.payload)}`,
        error instanceof Error ? error.stack : String(error),
      )
      throw error // Ensure SQS retries
    }
  }
}
