import {
  EventHandler,
  IEventHandler,
  SqsService,
} from '@mbc-cqrs-serverless/core'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { ACTION_SINGLE_IMPORT_PROCESS } from '../constant/sqs.constant'
import { ImportStatusEnum } from '../enum/import-status.enum'
import { ImportService } from '../import.service'
import { ImportEvent } from './import.event'

@EventHandler(ImportEvent)
export class ImportEventHandler implements IEventHandler<ImportEvent> {
  private readonly logger = new Logger(ImportEventHandler.name)

  constructor(
    private readonly sqsService: SqsService,
    private readonly configService: ConfigService,
    private readonly importService: ImportService,
  ) {}

  async execute(event: ImportEvent): Promise<any> {
    const queueUrl = this.configService.get<string>('IMPORT_QUEUE_URL')
    if (!queueUrl) throw new Error('IMPORT_QUEUE_URL is not configured')

    await this.sqsService.sendMessage(
      queueUrl,
      JSON.stringify({ action: ACTION_SINGLE_IMPORT_PROCESS, ...event }),
    )

    return await this.importService.updateStatus(
      event.importKey,
      ImportStatusEnum.QUEUED,
    )
  }
}
