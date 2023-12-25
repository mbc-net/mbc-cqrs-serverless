import { Logger } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'

import { CommandEventHandler } from '../commands/command.event.handler'
import { DynamoDbService } from '../data-store/dynamodb.service'
import { EventHandler } from '../decorators'
import { IEventHandler } from '../interfaces'
import {
  DataSyncCommandSfnEvent,
  StepFunctionStateInput,
} from './data-sync.sfn.event'

@EventHandler(DataSyncCommandSfnEvent)
export class DataSyncCommandSfnEventHandler
  implements IEventHandler<DataSyncCommandSfnEvent>
{
  private readonly logger: Logger = new Logger(
    DataSyncCommandSfnEventHandler.name,
  )

  constructor(
    private readonly dynamoDbService: DynamoDbService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async execute(
    event: DataSyncCommandSfnEvent,
  ): Promise<StepFunctionStateInput | StepFunctionStateInput[]> {
    this.logger.debug('executing::', event)

    const moduleName = this.dynamoDbService.getModuleName(
      event.commandTableName,
    )
    const handler = this.moduleRef.get<string, CommandEventHandler>(
      moduleName + '_CommandEventHandler',
      { strict: false },
    )
    return await handler.execute(event)
  }
}
