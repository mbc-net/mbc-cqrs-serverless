import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import {
  DataSyncCommandSfnEvent,
  StepFunctionStateInput,
} from '../command-events/data-sync.sfn.event'
import { DataSyncCommandSfnName } from '../command-events/sfn-name.enum'
import { S3Service } from '../data-store'
import { addSortKeyVersion, removeSortKeyVersion } from '../helpers/key'
import {
  CommandModel,
  CommandModuleOptions,
  DetailKey,
  INotification,
} from '../interfaces'
import { SnsService } from '../queue'
import { StepFunctionService } from '../step-func/step-function.service'
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
    private readonly sfnService: StepFunctionService,
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

    await this.commandService.updateTaskToken(event.commandKey, event.taskToken)

    if (event.commandRecord.version > 1) {
      const prevSk = addSortKeyVersion(
        removeSortKeyVersion(event.commandRecord.sk),
        event.commandRecord.version - 1,
      )

      let prevCommand: CommandModel | undefined
      try {
        // consistentRead: true — predecessor status across independent SFN
        // executions must not be a stale eventually-consistent read.
        //
        // Bounded retry (3 attempts, exponential backoff baseDelayMs * 2^(n-1)):
        // best-effort check — updateTaskToken already succeeded; checkNextToken
        // on the predecessor remains the primary resume path.
        prevCommand = await this.getItemWithRetry(
          { pk: event.commandRecord.pk, sk: prevSk },
          { consistentRead: true },
          3,
          100,
        )
      } catch (e) {
        // After app + SDK retries, treat as persistent degradation of the
        // self-resume backstop — do not fail the step (token already stored).
        this.logger.error(
          `[${event.commandKey.pk}] Could not read predecessor status for command v${event.commandRecord.version} after retries, self-resume backstop degraded: ` +
            `${e instanceof Error ? e.message : 'Unknown error'}`,
          e instanceof Error ? e.stack : undefined,
        )
        await this.publishAlarm(event, {
          self_resume_predecessor_read_failed: true,
          cause: e instanceof Error ? e.message : String(e),
        })
      }

      const finishStarted = getCommandStatus(
        DataSyncCommandSfnName.FINISH,
        CommandStatus.STATUS_STARTED,
      )
      const finishFinished = getCommandStatus(
        DataSyncCommandSfnName.FINISH,
        CommandStatus.STATUS_FINISHED,
      )
      const prevEnteredFinish =
        prevCommand?.status === finishStarted ||
        prevCommand?.status === finishFinished

      if (prevEnteredFinish) {
        this.logger.log(
          `[${event.commandKey.pk}] Prev command already in finish step — self-resuming v${event.commandRecord.version}`,
        )
        try {
          await this.sfnService.resumeExecution(event.taskToken, {
            result: 'resumed_by_prev_version',
            prevVersion: event.commandRecord.version - 1,
          })
        } catch (e) {
          await this.handleResumeExecutionError(event, e, {
            benignNames: new Set(['TaskDoesNotExist', 'TaskTimedOut']),
            logContext: `[${event.commandKey.pk}] Self-resume for v${event.commandRecord.version}`,
            alarmPayload: { self_resume_failed: true },
          })
        }
      }
    }

    return {
      result: {
        token: event.taskToken,
      },
    }
  }

  /**
   * Retry wrapper around commandService.getItem for the cross-execution
   * predecessor-status check in waitConfirmToken. Bounded and short —
   * smooths a single transient DDB failure; does not wait out an outage.
   */
  protected async getItemWithRetry(
    key: DetailKey,
    options: { consistentRead: boolean },
    maxAttempts: number,
    baseDelayMs: number,
  ): Promise<CommandModel> {
    let lastError: unknown
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.commandService.getItem(key, options)
      } catch (e) {
        lastError = e
        if (attempt < maxAttempts) {
          const delayMs = baseDelayMs * Math.pow(2, attempt - 1)
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
      }
    }
    throw lastError
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
        'next version must be ' + nextVersion + ' but got ' + commandVersion,
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

    const handlers = this.commandService.dataSyncHandlers
    if (handlers.length === 0) {
      this.logger.warn(
        `[${this.options.tableName}] transformData: no DataSyncHandlers registered — ` +
          `no sync will occur for ${this.options.tableName}`,
      )
    }
    return handlers.map((cls) => ({
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

    const nextCommand = await this.commandService.getNextCommand(
      event.commandKey,
    )
    if (!nextCommand) {
      this.logger.debug('No next command version found. Chain ends.')
      return null
    }

    if (nextCommand.taskToken) {
      this.logger.log(
        `Found waiting command v${nextCommand.version}. Resuming...`,
      )

      try {
        await this.sfnService.resumeExecution(nextCommand.taskToken, {
          result: 'resumed_by_prev_version',
          prevVersion: event.commandRecord.version,
        })
      } catch (e) {
        await this.handleResumeExecutionError(event, e, {
          benignNames: new Set(['TaskDoesNotExist']),
          logContext: `[${event.commandKey.pk}] Resume for v${nextCommand.version} (sk: ${nextCommand.sk})`,
          alarmPayload: {
            push_resume_failed: true,
            nextVersion: nextCommand.version,
            nextSk: nextCommand.sk,
          },
        })
      }
    } else {
      this.logger.warn(
        `Next command v${nextCommand.version} found but no token. Status: ${nextCommand.status}`,
      )
    }

    return null
  }

  protected async handleResumeExecutionError(
    event: DataSyncCommandSfnEvent,
    e: unknown,
    options: {
      benignNames: ReadonlySet<string>
      logContext: string
      alarmPayload: Record<string, unknown>
    },
  ): Promise<void> {
    const name = e instanceof Error ? e.name : undefined
    if (name && options.benignNames.has(name)) {
      this.logger.warn(`${options.logContext} already consumed (${name})`)
      return
    }

    this.logger.error(
      `${options.logContext} failed unexpectedly (${name ?? 'unknown'}): ` +
        `${e instanceof Error ? e.message : 'Unknown error'}`,
      e instanceof Error ? e.stack : undefined,
    )
    await this.publishAlarm(event, {
      ...options.alarmPayload,
      errorName: name ?? 'unknown',
      cause: e instanceof Error ? e.message : String(e),
    })
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
