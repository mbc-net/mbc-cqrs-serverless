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
      // Only tolerate a missing state machine when running under
      // serverless-offline (local development), where DynamoDB Streams can fire
      // before Step Functions Local has registered the state machine.
      // serverless-offline sets IS_OFFLINE and it is never set in a deployed
      // Lambda, so it is a reliable local-only signal (same check as
      // EmailService). SFN_ENDPOINT is NOT used here because it is a generic
      // endpoint override that may legitimately be set in production (VPC
      // endpoint, PrivateLink). In any other environment a missing state
      // machine is a real misconfiguration (wrong ARN, undeployed/deleted state
      // machine, deploy race) and must surface as a failure — otherwise the
      // command is silently written without its data-sync ever running, with no
      // Lambda error metric / stream retry / alarm to detect it.
      const isOffline =
        process.env.IS_OFFLINE === 'true' || process.env.IS_OFFLINE === '1'
      if (error?.name === 'StateMachineDoesNotExist' && isOffline) {
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
