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
    const ddbKeys = event.dynamodb?.Keys
    const ddbRecordId = `${ddbKeys.pk?.S || 'pk'}-${ddbKeys.sk?.S || 'sk'}`
      .replaceAll('#', '-')
      .replace('@', '-')
    const sfnExecName = `${event.tableName}-${ddbRecordId}-${Date.now()}`
    return await this.sfnService.startExecution(this.sfnArn, event, sfnExecName)
  }
}
