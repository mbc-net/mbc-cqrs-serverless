import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { DynamoDbService } from '../data-store'
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
    private readonly dynamoDbService: DynamoDbService,
  ) {
    this.sfnArn = config.get('SFN_COMMAND_ARN')
  }

  async execute(event: DataSyncNewCommandEvent): Promise<any> {
    this.logger.debug('executing::', event)
    const moduleName = this.dynamoDbService.getModuleName(event.tableName)
    const ddbKeys = event.dynamodb?.Keys
    const ddbRecordId = `${ddbKeys.pk?.S || 'pk'}-${ddbKeys.sk?.S || 'sk'}`
      .replaceAll('#', '-')
      .replace('@', '-v')
      .replace(
        /[^0-9A-Za-z_-]+/g,
        `__${Math.random().toString(36).substring(2, 4)}__`,
      )

    const sfnExecName = `${moduleName}-${ddbRecordId}-${Date.now()}`
    try {
      return await this.sfnService.startExecution(
        this.sfnArn,
        event,
        sfnExecName,
      )
    } catch (error: any) {
      // Only tolerate a missing state machine when running against Step
      // Functions Local, where DynamoDB Streams can fire before the state
      // machine has been registered. SFN_ENDPOINT is configured only for local
      // development (never in the production infra), so its presence is a
      // reliable signal. In any other environment a missing state machine is a
      // real misconfiguration (wrong ARN, undeployed/deleted state machine,
      // deploy race) and must surface as a failure — otherwise the command is
      // silently written without its data-sync ever running, with no Lambda
      // error metric / stream retry / alarm to detect it.
      const isLocalStepFunctions = !!this.config.get<string>('SFN_ENDPOINT')
      if (error?.name === 'StateMachineDoesNotExist' && isLocalStepFunctions) {
        this.logger.warn(
          `State machine not found (ARN: ${this.sfnArn}). ` +
            'This may happen during local development if the state machine is not yet registered. ' +
            `Skipping execution for: ${sfnExecName}`,
        )
        return
      }
      throw error
    }
  }
}
