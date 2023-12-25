import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { EventHandler } from '../decorators'
import { IEventHandler } from '../interfaces'
import { StepFunctionService } from '../step-func/step-function.service'
import { DataSyncNewCommandEvent } from './data-sync.new.event'

@EventHandler(DataSyncNewCommandEvent)
export class DataSyncNewCommandEventHandler
  implements IEventHandler<DataSyncNewCommandEvent>
{
  private readonly logger = new Logger(DataSyncNewCommandEventHandler.name)
  private sfnArn: string

  constructor(
    private readonly config: ConfigService,
    private readonly sfnService: StepFunctionService,
  ) {
    this.sfnArn = config.get('SFN_COMMAND_ARN')
  }

  async execute(event: DataSyncNewCommandEvent): Promise<any> {
    this.logger.debug('executing::', event)
    return await this.sfnService.startExecution(this.sfnArn, event)
  }
}
