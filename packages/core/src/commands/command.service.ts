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
import { isDeepStrictEqual } from 'util'

import { VER_SEPARATOR, VERSION_FIRST, VERSION_LATEST } from '../constants'
import { getUserContext } from '../context/user.context'
import { DynamoDbService } from '../data-store/dynamodb.service'
import { DATA_SYNC_HANDLER_METADATA } from '../decorators'
import { mergeDeep, pickKeys } from '../helpers'
import { addSortKeyVersion, removeSortKeyVersion } from '../helpers/key'
import {
  CommandInputModel,
  CommandModel,
  CommandModuleOptions,
  CommandPartialInputModel,
  DetailKey,
  INotification,
} from '../interfaces'
import { ICommandOptions } from '../interfaces/command.options.interface'
import { IDataSyncHandler } from '../interfaces/data-sync-handler.interface'
import { SnsService } from '../queue/sns.service'
import { ExplorerService } from '../services'
import { MODULE_OPTIONS_TOKEN } from './command.module-definition'
import { DataService } from './data.service'
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
    private readonly dataService: DataService,
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

  // partial data command
  async publishPartialUpdate(
    input: CommandPartialInputModel,
    opts?: ICommandOptions,
  ) {
    let item: CommandModel
    if (input.version > VERSION_FIRST) {
      item = await this.getItem({
        pk: input.pk,
        sk: addSortKeyVersion(input.sk, input.version),
      })
    } else {
      item = await this.getLatestItem({
        pk: input.pk,
        sk: removeSortKeyVersion(input.sk),
      })
    }
    if (!item) {
      throw new BadRequestException(
        'The input key is not a valid, item not found',
      )
    }
    const fullInput = mergeDeep({}, item, input, { version: item.version })

    this.logger.debug('publishPartialUpdate::', fullInput)
    return await this.publish(fullInput, opts)
  }

  // full data command
  async publish(input: CommandInputModel, opts?: ICommandOptions) {
    let inputVersion = input.version || VERSION_FIRST
    let item: CommandModel
    if (inputVersion === VERSION_LATEST) {
      item = await this.getLatestItem({
        pk: input.pk,
        sk: removeSortKeyVersion(input.sk),
      })
      inputVersion = item?.version || VERSION_FIRST
    } else if (inputVersion > VERSION_FIRST) {
      // check current version
      item = await this.getItem({
        pk: input.pk,
        sk: addSortKeyVersion(input.sk, inputVersion),
      })
      if (!item) {
        throw new BadRequestException(
          'Invalid input version. The input version must be equal to the latest version',
        )
      }
    }
    if (item && this.isNotCommandDirty(item, input)) {
      // do not update if command is not dirty
      return null
    }

    const { event, context } = getCurrentInvoke()
    const userContext = getUserContext(event)
    const version = inputVersion + 1

    const command: CommandModel = {
      ...input,
      sk: addSortKeyVersion(input.sk, version),
      version,
      source: opts?.source,
      requestId: opts?.requestId || context?.awsRequestId,
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

  async duplicate(key: DetailKey) {
    const item = await this.getItem(key)
    if (!item) {
      throw new BadRequestException(
        'The input key is not a valid, item not found',
      )
    }
    const { event, context } = getCurrentInvoke()
    const userContext = getUserContext(event)

    item.version += 1
    item.sk = addSortKeyVersion(item.sk, item.version)
    item.source = 'duplicated'
    item.requestId = context?.awsRequestId
    item.updatedAt = new Date()
    item.updatedBy = userContext.userId
    item.updatedIp = event?.requestContext?.http?.sourceIp

    this.logger.debug('duplicate::', item)
    await this.dynamoDbService.putItem(
      this.tableName,
      item,
      'attribute_not_exists(pk) AND attribute_not_exists(sk)',
    )

    return item
  }

  async updateStatus(key: DetailKey, status: string, notifyId?: string) {
    await this.dynamoDbService.updateItem(this.tableName, key, {
      set: { status },
    })

    // notification via SNS
    await this.snsService.publish<INotification>({
      action: 'command-status',
      ...key,
      table: this.tableName,
      id: notifyId || `${this.tableName}#${key.pk}#${key.sk}`,
      tenantCode: key.pk.substring(key.pk.indexOf('#') + 1),
      content: { status },
    })
  }

  async getItem(key: DetailKey): Promise<CommandModel> {
    if (!key.sk.includes(VER_SEPARATOR)) {
      return this.getLatestItem(key)
    }
    return await this.dynamoDbService.getItem(this.tableName, key)
  }

  async getLatestItem(key: DetailKey): Promise<CommandModel> {
    const lookUpStep = 5
    const dataItem = await this.dataService.getItem(key)
    let ver = (dataItem?.version || 0) + lookUpStep
    let isUp = true
    while (true) {
      if (ver <= VERSION_FIRST) {
        return null
      }

      const item = await this.getItem({
        pk: key.pk,
        sk: addSortKeyVersion(key.sk, ver),
      })
      if (item) {
        if (!isUp) {
          // look down
          return item
        }
        // continue look up
        ver += lookUpStep
      } else {
        // look down
        ver -= 1
        isUp = false
      }
    }
  }

  isNotCommandDirty(item: CommandModel, input: CommandInputModel) {
    const comparedKeys: (keyof CommandInputModel)[] = [
      'id',
      'code',
      'name',
      'tenantCode',
      'type',
      'isDeleted',
      'seq',
      'ttl',
      'attributes',
    ]

    return isDeepStrictEqual(
      structuredClone(pickKeys(item, comparedKeys)),
      structuredClone(pickKeys(input, comparedKeys)),
    )
  }
}
