import { Inject, Injectable, Logger } from '@nestjs/common'

import { KEY_SEPARATOR } from '../constants'
import { getUserContext } from '../context/user'
import { SessionService } from '../data-store/session.service'
import {
  addSortKeyVersion,
  generateId,
  getTenantCode,
  parsePkSkFromId,
  removeSortKeyVersion,
} from '../helpers/key'
import { transformCommandToData } from '../helpers/transform'
import {
  CommandModel,
  CommandModuleOptions,
  DataEntity,
  DataListEntity,
  DataModel,
  DetailKey,
  ICommandOptions,
} from '../interfaces'
import { MODULE_OPTIONS_TOKEN } from './command.module-definition'
import { CommandService } from './command.service'
import { DataService } from './data.service'

export interface IMergeOptions<TItem extends { id: string }> {
  /** Set true to merge pending async commands into the result. If false/undefined → passthrough. */
  latestFlg?: boolean
  /**
   * Transform a CommandModel into the same shape as a TItem returned by
   * the query.
   */
  transformCommand: (cmd: CommandModel, existing?: TItem) => TItem
  /**
   * Optional filter applied AFTER transformCommand for create-new rows.
   */
  matchesFilter?: (item: TItem) => boolean
}

@Injectable()
export class Repository {
  private readonly logger = new Logger(Repository.name)
  private readonly moduleTableName: string

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: CommandModuleOptions,
    private readonly dataService: DataService,
    private readonly commandService: CommandService,
    private readonly sessionService: SessionService,
  ) {
    this.moduleTableName = this.options.tableName
  }

  /**
   * Get a single data item, merging a pending async command when session exists.
   */
  async getItem(key: DetailKey, options: ICommandOptions): Promise<DataModel> {
    const userContext = getUserContext(options.invokeContext)
    const userId = userContext?.userId
    const tenantCode = getTenantCode(key.pk)

    if (userId && tenantCode) {
      const itemId = generateId(key.pk, key.sk)

      const session = await this.sessionService.get(
        userId,
        tenantCode,
        this.moduleTableName,
        itemId,
      )

      if (session) {
        this.logger.debug(
          `getItem session merge — version ${session.version}`,
          key,
        )
        const cmd = await this.commandService.getItem({
          pk: key.pk,
          sk: addSortKeyVersion(key.sk, session.version),
        })
        if (cmd) {
          const existing = await this.dataService.getItem(key)
          return transformCommandToData(cmd, existing)
        }
      }
    }

    return this.dataService.getItem(key)
  }

  /**
   * List items from the data table with optional merge of pending async commands (DynamoDB).
   */
  async listItemsByPk(
    pk: string,
    opts?: {
      sk?: {
        skExpression: string
        skAttributeValues: Record<string, string>
        skAttributeNames?: Record<string, string>
      }
      startFromSk?: string
      limit?: number
      order?: 'asc' | 'desc'
    },
    mergeOptions?: { latestFlg?: boolean },
    options?: ICommandOptions,
  ): Promise<DataListEntity> {
    const baseResult = await this.dataService.listItemsByPk(pk, opts)

    if (!mergeOptions?.latestFlg || !options) {
      return baseResult
    }

    const userContext = getUserContext(options.invokeContext)
    const userId = userContext?.userId
    if (!userId) return baseResult

    const tenantCode = getTenantCode(pk)
    if (!tenantCode) {
      return baseResult
    }

    const sessions = await this.sessionService.listByUser(
      userId,
      tenantCode,
      this.moduleTableName,
    )
    if (!sessions.length) return baseResult

    this.logger.debug(`listItemsByPk merge — ${sessions.length} sessions`, {
      pk,
    })

    const itemMap = new Map<string, DataEntity>(
      baseResult.items.map((item) => [item.id, item]),
    )
    const skPrefix = `${this.moduleTableName}${KEY_SEPARATOR}`

    for (const session of sessions) {
      if (!session.sk.startsWith(skPrefix)) {
        continue
      }
      const itemId = session.sk.slice(skPrefix.length)

      const existing = itemMap.get(itemId) as DataModel | undefined
      let cmdPk = pk
      let skBase: string | undefined
      if (existing?.sk) {
        skBase = removeSortKeyVersion(existing.sk)
      } else {
        const parsed = parsePkSkFromId(itemId)
        if (!parsed || parsed.pk !== pk) {
          continue
        }
        cmdPk = parsed.pk
        skBase = parsed.skBase
      }
      if (!skBase) {
        continue
      }

      const cmd = await this.commandService.getItem({
        pk: cmdPk,
        sk: addSortKeyVersion(skBase, session.version),
      })
      if (!cmd) continue

      const transformed = transformCommandToData(cmd, existing)

      if (cmd.isDeleted) {
        itemMap.delete(itemId)
      } else if (itemMap.has(itemId)) {
        itemMap.set(itemId, new DataEntity(transformed))
      } else {
        itemMap.set(itemId, new DataEntity(transformed))
      }
    }

    return new DataListEntity({
      lastSk: baseResult.lastSk,
      items: [...itemMap.values()],
    })
  }

  /**
   * List items from RDS (or any source) with optional merge of pending async commands.
   */
  async listItems<TItem extends { id: string }>(
    query: () => Promise<{ total: number; items: TItem[] }>,
    mergeOptions?: IMergeOptions<TItem>,
    options?: ICommandOptions,
  ): Promise<{ total: number; items: TItem[] }> {
    const baseResult = await query()

    if (!mergeOptions?.latestFlg || !options) {
      return baseResult
    }

    const userContext = getUserContext(options.invokeContext)
    const userId = userContext?.userId
    if (!userId) return baseResult

    const tenantCode = userContext.tenantCode
    if (!tenantCode) return baseResult

    const sessions = await this.sessionService.listByUser(
      userId,
      tenantCode,
      this.moduleTableName,
    )
    if (!sessions.length) return baseResult

    this.logger.debug(`listItems merge — ${sessions.length} sessions`, {
      tenantCode,
    })

    const itemMap = new Map<string, TItem>(
      baseResult.items.map((item) => [item.id, item]),
    )
    let adjustedTotal = baseResult.total
    const skPrefix = `${this.moduleTableName}${KEY_SEPARATOR}`

    for (const session of sessions) {
      if (!session.sk.startsWith(skPrefix)) {
        continue
      }
      const itemId = session.sk.slice(skPrefix.length)

      const existing = itemMap.get(itemId)

      let cmdPk: string | undefined
      let skBase: string | undefined
      const existingSk = (existing as unknown as { sk?: string })?.sk
      const existingPk = (existing as unknown as { pk?: string })?.pk

      if (existing && existingSk && existingPk) {
        cmdPk = existingPk
        skBase = removeSortKeyVersion(existingSk)
      } else {
        const parsed = parsePkSkFromId(itemId)
        if (!parsed) {
          continue
        }
        cmdPk = parsed.pk
        skBase = parsed.skBase
      }
      if (!cmdPk || !skBase) {
        continue
      }

      const cmd = await this.commandService.getItem({
        pk: cmdPk,
        sk: addSortKeyVersion(skBase, session.version),
      })
      if (!cmd) continue

      const transformed = mergeOptions.transformCommand(cmd, existing)

      if (cmd.isDeleted) {
        if (itemMap.has(itemId)) {
          itemMap.delete(itemId)
          adjustedTotal--
        }
      } else if (itemMap.has(itemId)) {
        itemMap.set(itemId, transformed)
      } else {
        if (
          !mergeOptions.matchesFilter ||
          mergeOptions.matchesFilter(transformed)
        ) {
          itemMap.set(itemId, transformed)
          adjustedTotal++
        }
      }
    }

    return { total: adjustedTotal, items: [...itemMap.values()] }
  }
}
