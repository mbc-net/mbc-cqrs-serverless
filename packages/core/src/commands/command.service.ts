import { getCurrentInvoke } from '@codegenie/serverless-express'
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Type,
} from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'

import { getUserContext } from '../context/user.context'
import { DynamoDbService } from '../data-store/dynamodb.service'
import { DATA_SYNC_HANDLER_METADATA } from '../decorators'
import { addSortKeyVersion } from '../helpers/key'
import {
  CommandInputModel,
  CommandModel,
  CommandModuleOptions,
  DetailKey,
  INotification,
} from '../interfaces'
import { IDataSyncHandler } from '../interfaces/data-sync-handler.interface'
import { SnsService } from '../queue/sns.service'
import { ExplorerService } from '../services'
import { MODULE_OPTIONS_TOKEN } from './command.module-definition'
import { DataSyncDdsHandler } from './handlers/data-sync-dds.handler'

const TABLE_NAME = Symbol('command')
const DATA_SYNC_HANDLER = Symbol(DATA_SYNC_HANDLER_METADATA)

export type DataSyncHandlerType = Type<IDataSyncHandler>

@Injectable()
export class CommandService implements OnModuleInit {
  private logger: Logger
  private [TABLE_NAME]: string
  private [DATA_SYNC_HANDLER]: IDataSyncHandler[] = []

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: CommandModuleOptions,
    private readonly dynamoDbService: DynamoDbService,
    private readonly explorerService: ExplorerService,
    private readonly moduleRef: ModuleRef,
    private readonly snsService: SnsService,
    private readonly dataSyncDdsHandler: DataSyncDdsHandler,
  ) {
    this.tableName = this.dynamoDbService.getTableName(
      this.options.tableName,
      'command',
    )
    this.logger = new Logger(`${CommandService.name}:${this.tableName}`)
  }

  onModuleInit() {
    if (!this.options.disableDefaulHandler) {
      this[DATA_SYNC_HANDLER] = [this.dataSyncDdsHandler]
    }
    if (this.options.dataSyncHandlers?.length) {
      // this.logger.debug('init data sync handlers')
      this[DATA_SYNC_HANDLER].push(
        ...this.options.dataSyncHandlers.map((HandlerClass) =>
          this.moduleRef.get(HandlerClass, { strict: false }),
        ),
      )
    }
    this.logger.debug('find data sync handlers from decorator')
    const { dataSyncHandlers } = this.explorerService.exploreDataSyncHandlers(
      this.options.tableName,
    )

    this[DATA_SYNC_HANDLER].push(
      ...dataSyncHandlers
        .map((handler) => this.moduleRef.get(handler, { strict: false }))
        .filter((handler) => !!handler),
    )
    // this.logger.debug(
    //   'data sync handlers length: ' + this[DATA_SYNC_HANDLER].length,
    // )
  }

  set tableName(name: string) {
    this[TABLE_NAME] = name
  }

  get tableName(): string {
    return this[TABLE_NAME]
  }

  get dataSyncHandlers() {
    // this.logger.debug(
    //   'dataSyncHandlers size:: ' + this[DATA_SYNC_HANDLER].length,
    // )
    return this[DATA_SYNC_HANDLER]
  }

  getDataSyncHandler(name: string): IDataSyncHandler {
    return this.dataSyncHandlers.find(
      (handler) => handler.constructor.name === name,
    )
  }

  async publish(input: CommandInputModel) {
    const inputVersion = input.version || 0
    if (inputVersion) {
      // check current version
      const item = await this.getItem({
        pk: input.pk,
        sk: addSortKeyVersion(input.sk, inputVersion),
      })
      if (!item) {
        throw new BadRequestException(
          'Invalid input version. The input version must be equal to the latest version',
        )
      }
    }

    const { event, context } = getCurrentInvoke()
    const userContext = getUserContext(event)
    const version = inputVersion + 1

    const command: CommandModel = {
      ...input,
      sk: addSortKeyVersion(input.sk, version),
      version,
      requestId: context?.awsRequestId,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userContext.userId,
      updatedBy: userContext.userId,
      createdIp: event?.requestContext?.http?.sourceIp,
      updatedIp: event?.requestContext?.http?.sourceIp,
    }
    this.logger.debug('publish::', command)
    await this.dynamoDbService.putItem(
      this.tableName,
      command,
      'attribute_not_exists(pk) AND attribute_not_exists(sk)',
    )
    return command
  }

  async updateStatus(key: DetailKey, status: string, notifyId?: string) {
    await this.dynamoDbService.updateItem(this.tableName, key, {
      set: { status },
    })

    // notification via SNS
    await this.snsService.publish<INotification>({
      action: 'command-status',
      ...key,
      id: notifyId || `${this.tableName}#${key.pk}#${key.sk}`,
      tenantCode: key.pk.substring(key.pk.indexOf('#') + 1),
      content: { status },
    })
  }

  async getItem(key: DetailKey): Promise<CommandModel> {
    return await this.dynamoDbService.getItem(this.tableName, key)
  }
}
