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
import { getUserContext } from '../context/user'
import { DynamoDbService } from '../data-store/dynamodb.service'
import { DATA_SYNC_HANDLER_METADATA } from '../decorators'
import { mergeDeep, pickKeys } from '../helpers'
import {
  addSortKeyVersion,
  getSortKeyVersion,
  getTenantCode,
  removeSortKeyVersion,
} from '../helpers/key'
import {
  CommandInputModel,
  CommandModel,
  CommandModuleOptions,
  CommandPartialInputModel,
  DetailKey,
  ICommandService,
  INotification,
} from '../interfaces'
import { ICommandOptions } from '../interfaces/command.options.interface'
import { IDataSyncHandler } from '../interfaces/data-sync-handler.interface'
import { SnsService } from '../queue/sns.service'
import { ExplorerService } from '../services'
import { MODULE_OPTIONS_TOKEN } from './command.module-definition'
import { DataService } from './data.service'
import { TableType } from './enums'
import { DataSyncDdsHandler } from './handlers/data-sync-dds.handler'
import { TtlService } from './ttl.service'

const TABLE_NAME = Symbol('command')
const DATA_SYNC_HANDLER = Symbol(DATA_SYNC_HANDLER_METADATA)

export type DataSyncHandlerType = Type<IDataSyncHandler>

@Injectable()
export class CommandService implements OnModuleInit, ICommandService {
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
    private readonly ttlService: TtlService,
  ) {
    this.tableName = this.dynamoDbService.getTableName(
      this.options.tableName,
      TableType.COMMAND,
    )
    this.logger = new Logger(`${CommandService.name}:${this.tableName}`)
  }
  publishItem(key: DetailKey): Promise<any | null> {
    throw new Error('Method not implemented.')
  }

  onModuleInit() {
    if (!this.options.disableDefaultHandler) {
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

  async publishPartialUpdateSync(
    input: CommandPartialInputModel,
    options: ICommandOptions,
  ): Promise<CommandModel> {
    const item: CommandModel = await this.dataService.getItem({
      pk: input.pk,
      sk: input.sk,
    })

    if (!item || item.version !== input.version) {
      throw new BadRequestException(
        'The input is not a valid, item not found or version not match',
      )
    }
    if (!Object.keys(input).includes('ttl')) {
      delete item.ttl
    }
    const fullInput = mergeDeep({}, item, input, { version: item.version })

    this.logger.debug('publishPartialUpdateSync::', fullInput)
    return await this.publishSync(fullInput, options)
  }

  async publishPartialUpdateAsync(
    input: CommandPartialInputModel,
    options: ICommandOptions,
  ): Promise<CommandModel> {
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
    if (!Object.keys(input).includes('ttl')) {
      delete item.ttl
    }
    const fullInput = mergeDeep({}, item, input, { version: item.version })

    this.logger.debug('publishPartialUpdate::', fullInput)
    return await this.publishAsync(fullInput, options)
  }

  /**
   * @deprecated Use {@link publishPartialUpdateAsync} instead.
   * This function is outdated and will be removed in the next major release.
   */
  async publishPartialUpdate(
    input: CommandPartialInputModel,
    options: ICommandOptions,
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
    if (!Object.keys(input).includes('ttl')) {
      delete item.ttl
    }
    const fullInput = mergeDeep({}, item, input, { version: item.version })

    this.logger.debug('publishPartialUpdate::', fullInput)
    return await this.publish(fullInput, options)
  }

  async publishSync(
    input: CommandInputModel,
    options: ICommandOptions,
  ): Promise<CommandModel> {
    const item = await this.dataService.getItem({ pk: input.pk, sk: input.sk })

    let inputVersion = input.version ?? VERSION_FIRST

    if (inputVersion === VERSION_LATEST) {
      inputVersion = item?.version ?? VERSION_FIRST
    } else if ((item?.version ?? 0) !== inputVersion) {
      throw new BadRequestException(
        'Invalid input version. The input version must be equal to the latest version',
      )
    }

    const userContext = getUserContext(options.invokeContext)
    const requestId =
      options?.requestId || options.invokeContext?.context?.awsRequestId
    const sourceIp =
      options.invokeContext?.event?.requestContext?.http?.sourceIp
    const version = (item?.version ?? inputVersion) + 1

    const command: CommandModel = {
      ttl: await this.ttlService.calculateTtl(
        TableType.DATA,
        getTenantCode(input.pk),
      ),
      ...input,
      version,
      source: options?.source,
      requestId,
      createdAt: new Date(),
      updatedAt: item?.updatedAt ?? new Date(),
      createdBy: userContext.userId,
      updatedBy: item?.updatedBy ?? userContext.userId,
      createdIp: sourceIp,
      updatedIp: item?.updatedIp ?? sourceIp,
    }
    this.logger.debug('publishSync::', command)

    await this.dataService.publish(command)

    const targetSyncHandlers = this.dataSyncHandlers?.filter(
      (handler) => handler.type !== 'dynamodb',
    )

    await Promise.all(targetSyncHandlers.map((handler) => handler.up(command)))

    return command
  }

  async publishAsync(
    input: CommandInputModel,
    options: ICommandOptions,
  ): Promise<CommandModel | null> {
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

    const userContext = getUserContext(options.invokeContext)
    const requestId =
      options?.requestId || options.invokeContext?.context?.awsRequestId
    const sourceIp =
      options.invokeContext?.event?.requestContext?.http?.sourceIp
    const version = inputVersion + 1

    const command: CommandModel = {
      ttl: await this.ttlService.calculateTtl(
        TableType.DATA,
        getTenantCode(input.pk),
      ),
      ...input,
      sk: addSortKeyVersion(input.sk, version),
      version,
      source: options?.source,
      requestId,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userContext.userId,
      updatedBy: userContext.userId,
      createdIp: sourceIp,
      updatedIp: sourceIp,
    }
    this.logger.debug('publish::', command)
    await this.dynamoDbService.putItem(
      this.tableName,
      command,
      'attribute_not_exists(pk) AND attribute_not_exists(sk)',
    )
    return command
  }

  /**
   * @deprecated Use {@link publishAsync} instead.
   * This function is outdated and will be removed in the next major release.
   */
  async publish(input: CommandInputModel, options: ICommandOptions) {
    return await this.publishAsync(input, options)
  }

  async duplicate(key: DetailKey, options: ICommandOptions) {
    const item = await this.getItem(key)
    if (!item) {
      throw new BadRequestException(
        'The input key is not a valid, item not found',
      )
    }
    const userContext = getUserContext(options.invokeContext)

    item.version += 1
    item.sk = addSortKeyVersion(item.sk, item.version)
    item.source = 'duplicated'
    item.requestId =
      options?.requestId || options.invokeContext?.context?.awsRequestId
    item.updatedAt = new Date()
    item.updatedBy = userContext.userId
    item.updatedIp =
      options.invokeContext?.event?.requestContext?.http?.sourceIp

    this.logger.debug('duplicate::', item)
    await this.dynamoDbService.putItem(
      this.tableName,
      item,
      'attribute_not_exists(pk) AND attribute_not_exists(sk)',
    )

    return item
  }

  async reSyncData() {
    const targetSyncHandlers = this.dataSyncHandlers?.filter(
      (handler) => handler.type !== 'dynamodb',
    )

    if (!targetSyncHandlers?.length) {
      this.logger.debug('no data sync handlers')
      return
    }

    const dataTableName = this.dataService.tableName
    let startKey: DetailKey = undefined
    while (true) {
      const res = await this.dynamoDbService.listAllItems(
        dataTableName,
        startKey,
      )

      if (res?.items?.length) {
        for (const item of res.items) {
          item.sk = addSortKeyVersion(item.sk, item.version)
          for (const handler of targetSyncHandlers) {
            await handler.up(item)
          }
        }
      }

      startKey = res?.lastKey
      if (!startKey) {
        break
      }
    }
  }

  async updateStatus(key: DetailKey, status: string, notifyId?: string) {
    const item = await this.dynamoDbService.updateItem(this.tableName, key, {
      set: { status },
    })

    // notification via SNS
    await this.snsService.publish<INotification>({
      action: 'command-status',
      ...key,
      table: this.tableName,
      id: notifyId || `${this.tableName}#${key.pk}#${key.sk}`,
      tenantCode: key.pk.substring(key.pk.indexOf('#') + 1),
      content: { status, source: item?.source },
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

  async updateTtl(key: DetailKey) {
    const version = getSortKeyVersion(key.sk)
    const sk = removeSortKeyVersion(key.sk)
    if (version <= VERSION_FIRST + 1) {
      return null
    }

    const previousSk = addSortKeyVersion(sk, version - 1)

    const command = await this.dynamoDbService.getItem(this.tableName, {
      pk: key.pk,
      sk: previousSk,
    })
    if (!command) {
      return null
    }
    command.sk = previousSk
    const ttl = await this.ttlService.calculateTtl(
      TableType.COMMAND,
      getTenantCode(key.pk),
    )

    command.ttl = ttl

    this.logger.debug('updateTtl::', command)
    return await this.dynamoDbService.putItem(this.tableName, command)
  }

  async updateTaskToken(key: DetailKey, token: string) {
    this.logger.debug(`Saving taskToken for ${key.pk}#${key.sk}`)

    return await this.dynamoDbService.updateItem(this.tableName, key, {
      set: { taskToken: token },
    })
  }

  async getNextCommand(currentKey: DetailKey): Promise<CommandModel> {
    this.logger.debug(
      `Getting next command for ${currentKey.pk}#${currentKey.sk}`,
    )

    const nextKey = {
      pk: currentKey.pk,
      sk: addSortKeyVersion(
        removeSortKeyVersion(currentKey.sk),
        getSortKeyVersion(currentKey.sk) + 1,
      ),
    }
    return await this.dynamoDbService.getItem(this.tableName, nextKey)
  }
}
