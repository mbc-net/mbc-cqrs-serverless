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
  sortKeyBaseFromId,
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
  /** * Set true to merge pending async commands into the result. 
   * If false/undefined -> acts as a simple passthrough. 
   */
  latestFlg?: boolean
  
  /**
   * Transform a CommandModel into the same shape as a TItem returned by the query.
   * The `existing` parameter is provided for update cases to merge unchanged fields.
   */
  transformCommand: (cmd: CommandModel, existing?: TItem) => TItem
  
  /**
   * Optional filter applied AFTER transformCommand for "create-new" rows.
   * Prevents newly created items from appearing in lists where they don't match the current search criteria.
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
   * Get a single data item, merging a pending async command when a session exists.
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
   * List items from the DynamoDB data table with an optional merge of pending async commands.
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

    // Map preserves insertion order for existing items
    const itemMap = new Map<string, DataEntity>(
      baseResult.items.map((item) => [item.id, item]),
    )
    
    // Separate array to collect newly created items so they can be prepended
    const newItems: DataEntity[] = []
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
        // Since we already know the exact PK from the method parameter, 
        // we can safely extract the skBase without strict 2-segment assumptions.
        skBase = sortKeyBaseFromId(pk, itemId)
        if (!skBase) {
          continue
        }
      }

      const cmd = await this.commandService.getItem({
        pk: cmdPk,
        sk: addSortKeyVersion(skBase, session.version),
      })
      if (!cmd) continue

      const transformed = transformCommandToData(cmd, existing)

      if (cmd.isDeleted) {
        // Delete the item from the map
        itemMap.delete(itemId)
      } else if (itemMap.has(itemId)) {
        // Update: preserves the original sort order in the Map
        itemMap.set(itemId, new DataEntity(transformed))
      } else {
        // Create-new: push to the newItems array
        newItems.push(new DataEntity(transformed))
      }
    }

    // Sort newly created items by createdAt descending
    if (newItems.length > 1) {
      newItems.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return timeB - timeA
      })
    }

    return new DataListEntity({
      lastSk: baseResult.lastSk,
      // Prepend newly created items to the top of the list
      items: [...newItems, ...itemMap.values()],
    })
  }

  /**
   * List items from an external source (e.g., RDS/Elasticsearch) 
   * with an optional merge of pending async commands.
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
    const newItems: TItem[] = []
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
        // Fallback: Strictly parse the ID assuming a 2-segment PK format ({type}#{tenantCode})
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
        // Delete the item from the map
        if (itemMap.has(itemId)) {
          itemMap.delete(itemId)
          adjustedTotal--
        }
      } else if (itemMap.has(itemId)) {
        // Update: preserves original position
        itemMap.set(itemId, transformed)
      } else {
        // Create-new: check if it satisfies the current query filters
        if (
          !mergeOptions.matchesFilter ||
          mergeOptions.matchesFilter(transformed)
        ) {
          newItems.push(transformed)
          adjustedTotal++
        }
      }
    }

    // Sort newly created items by createdAt descending (safely fallback to 0 if field is missing)
    if (newItems.length > 1) {
      newItems.sort((a: any, b: any) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return timeB - timeA
      })
    }

    return { 
      total: adjustedTotal, 
      items: [...newItems, ...itemMap.values()] 
    }
  }
}