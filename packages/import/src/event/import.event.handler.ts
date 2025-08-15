import {
  EventHandler,
  IEventHandler,
  SnsService,
} from '@mbc-cqrs-serverless/core'
import { Logger } from '@nestjs/common'

import { ImportStatusEnum } from '../enum/import-status.enum'
import { ImportService } from '../import.service'
import { IMPORT_EVENT_ACTION, ImportEvent } from './import.event'

@EventHandler(ImportEvent)
export class ImportEventHandler implements IEventHandler<ImportEvent> {
  private readonly logger = new Logger(ImportEventHandler.name)

  constructor(
    private readonly snsService: SnsService,
    private readonly importService: ImportService,
  ) {}

  async execute(event: ImportEvent): Promise<any> {
    this.logger.debug('import event executing::', event)
    // publish event to sns
    await this.snsService.publish({ action: IMPORT_EVENT_ACTION, ...event })

    return await this.importService.updateStatus(
      event.importKey,
      ImportStatusEnum.QUEUED,
    )
  }
}
