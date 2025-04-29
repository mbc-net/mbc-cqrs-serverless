import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import {
  DataSyncCommandSfnEvent,
  StepFunctionStateInput,
} from '../command-events/data-sync.sfn.event'
import { DataSyncCommandSfnName } from '../command-events/sfn-name.enum'
import { S3Service } from '../data-store'
import { addSortKeyVersion, removeSortKeyVersion } from '../helpers/key'
import { CommandModuleOptions, INotification } from '../interfaces'
import { SnsService } from '../queue'
import { MODULE_OPTIONS_TOKEN } from './command.module-definition'
import { CommandService } from './command.service'
import { DataService } from './data.service'
import { CommandStatus, getCommandStatus } from './enums/status.enum'
import { HistoryService } from './history.service'

@Injectable()
export class CommandEventHandler {
  private readonly logger: Logger
  private readonly alarmTopicArn: string

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: CommandModuleOptions,
    private readonly commandService: CommandService,
    private readonly dataService: DataService,
    private readonly historyService: HistoryService,
    private readonly s3Service: S3Service,
    private readonly snsService: SnsService,
    private readonly config: ConfigService,
  ) {
    this.logger = new Logger(
      `${CommandEventHandler.name}:${this.options.tableName}`,
    )
    this.alarmTopicArn = this.config.get<string>('SNS_ALARM_TOPIC_ARN')
  }

  async execute(
    event: DataSyncCommandSfnEvent,
  ): Promise<StepFunctionStateInput | StepFunctionStateInput[]> {
    this.logger.debug('executing::', event)
    await this.commandService.updateStatus(
      event.commandKey,
      getCommandStatus(event.stepStateName, CommandStatus.STATUS_STARTED),
      event.commandRecord.requestId,
    )
    try {
      const ret = await this.handleStepState(event)
      await this.commandService.updateStatus(
        event.commandKey,
        getCommandStatus(event.stepStateName, CommandStatus.STATUS_FINISHED),
        event.commandRecord.requestId,
      )

      return ret
    } catch (error) {
      await this.commandService.updateStatus(
        event.commandKey,
        getCommandStatus(event.stepStateName, CommandStatus.STATUS_FAILED),
        event.commandRecord.requestId,
      )
      await this.publishAlarm(event, (error as Error).stack)
      throw error
    }
  }

  protected async handleStepState(
    event: DataSyncCommandSfnEvent,
  ): Promise<StepFunctionStateInput | StepFunctionStateInput[]> {
    switch (event.stepStateName) {
      case DataSyncCommandSfnName.CHECK_VERSION:
        return await this.checkVersion(event)

      case DataSyncCommandSfnName.WAIT_PREV_COMMAND:
        return await this.waitConfirmToken(event)

      case DataSyncCommandSfnName.SET_TTL_COMMAND:
        return await this.setTtlCommand(event)

      case DataSyncCommandSfnName.HISTORY_COPY:
        return await this.historyCopy(event)

      case DataSyncCommandSfnName.TRANSFORM_DATA:
        return await this.transformData(event)

      case DataSyncCommandSfnName.SYNC_DATA:
        return await this.syncData(event)

      case DataSyncCommandSfnName.FINISH:
        return await this.checkNextToken(event)

      default:
        throw new Error('step function state not found!')
    }
  }

  protected async waitConfirmToken(
    event: DataSyncCommandSfnEvent,
  ): Promise<StepFunctionStateInput> {
    this.logger.debug('waitConfirmToken::', event)
    return {
      result: {
        token: event.taskToken,
      },
    }
  }

  protected async checkVersion(
    event: DataSyncCommandSfnEvent,
  ): Promise<StepFunctionStateInput> {
    this.logger.debug('Checking version::', event.commandRecord)
    const sk = removeSortKeyVersion(event.commandRecord.sk)
    const data = await this.dataService.getItem({
      pk: event.commandRecord.pk,
      sk,
    })
    this.logger.debug('Checking version for data::', data)
    const commandVersion = event.commandRecord.version
    const nextVersion = 1 + (data?.version || 0)
    const oldCommand = await this.commandService.getItem({
      pk: event.commandRecord.pk,
      sk: addSortKeyVersion(sk, commandVersion - 1),
    })

    if (nextVersion === commandVersion) {
      return {
        result: 0,
      }
    }

    if (nextVersion < commandVersion) {
      if (!oldCommand) {
        return {
          result: 0,
        }
      }
      // wait for previous version is stable
      return {
        result: 1,
      }
    }

    const errorDetails = {
      result: -1,
      error: 'version is not match',
      cause:
        'next version must be ' + nextVersion + ' but got ' + new String(1),
    }

    await this.publishAlarm(event, errorDetails)
    return errorDetails
  }

  protected async setTtlCommand(
    event: DataSyncCommandSfnEvent,
  ): Promise<StepFunctionStateInput> {
    this.logger.debug('setTtlCommand:: ', event.commandRecord)

    await this.commandService.updateTtl({
      pk: event.commandRecord.pk,
      sk: event.commandRecord.sk,
    })

    return {
      result: 'ok',
    }
  }

  protected async historyCopy(
    event: DataSyncCommandSfnEvent,
  ): Promise<StepFunctionStateInput> {
    this.logger.debug('historyCopy:: ', event.commandRecord)
    await this.historyService.publish({
      pk: event.commandRecord.pk,
      sk: removeSortKeyVersion(event.commandRecord.sk),
    })

    return {
      result: 'ok',
    }
  }

  protected async transformData(
    event: DataSyncCommandSfnEvent,
  ): Promise<StepFunctionStateInput[]> {
    this.logger.debug('transformData:: ', event.commandRecord)

    return this.commandService.dataSyncHandlers.map((cls) => ({
      prevStateName: event.stepStateName,
      result: cls.constructor.name,
    }))
  }

  protected async syncData(
    event: DataSyncCommandSfnEvent,
  ): Promise<StepFunctionStateInput> {
    this.logger.debug('syncData:: ', event.commandRecord)

    const handlerName = event.input?.result as string
    if (!handlerName) {
      throw new Error('SyncDataHandler not found!')
    }
    const handler = this.commandService.getDataSyncHandler(handlerName)
    if (!handler) {
      throw new Error('SyncDataHandler empty!')
    }
    const commandModel = await event.getFullCommandRecord(this.s3Service)

    return handler.up(commandModel)
  }

  protected async checkNextToken(
    event: DataSyncCommandSfnEvent,
  ): Promise<StepFunctionStateInput> {
    this.logger.debug('checkNextToken:: ', event.commandRecord)

    return null
  }

  protected async publishAlarm(
    event: DataSyncCommandSfnEvent,
    errorDetails: any,
  ): Promise<void> {
    this.logger.debug('event', event)
    const alarm: INotification = {
      action: 'sfn-alarm',
      id: `${event.commandKey.pk}#${event.commandKey.sk}`,
      table: this.options.tableName,
      pk: event.commandKey.pk,
      sk: event.commandKey.sk,
      tenantCode: event.commandKey.pk.substring(
        event.commandKey.pk.indexOf('#') + 1,
      ),
      content: {
        errorMessage: errorDetails,
        sfnId: event.context.Execution.Id,
      },
    }
    this.logger.error('alarm:::', alarm)
    await this.snsService.publish<INotification>(alarm, this.alarmTopicArn)
  }
}
