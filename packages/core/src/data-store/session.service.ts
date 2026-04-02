import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { KEY_SEPARATOR } from '../constants'
import { DynamoDbService } from './dynamodb.service'
import { SessionItem } from './session.interface'

/**
 * Upper-bound for session entries fetched per user/module in a single query.
 * Sessions are short-lived (RYW_SESSION_TTL_MINUTES) so this stays cheap.
 * Prevents silent truncation from DynamoDbService's default limit of 10.
 */
const MAX_SESSION_ENTRIES = 1000

const SESSION_TABLE_SUFFIX = 'session'

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name)
  private readonly sessionTableName: string
  private readonly ttlSeconds: number
  /** When unset or invalid, session rows are not written (RYW read path still works on empty). */
  private readonly sessionWritesEnabled: boolean

  constructor(
    private readonly dynamoDbService: DynamoDbService,
    private readonly config: ConfigService,
  ) {
    const nodeEnv = this.config.get<string>('NODE_ENV')
    const appName = this.config.get<string>('APP_NAME')
    this.sessionTableName = `${nodeEnv}-${appName}-${SESSION_TABLE_SUFFIX}`

    const ttlMinutes = Number(
      this.config.get<string>('RYW_SESSION_TTL_MINUTES'),
    )
    this.sessionWritesEnabled = !Number.isNaN(ttlMinutes) && ttlMinutes > 0
    this.ttlSeconds = this.sessionWritesEnabled ? ttlMinutes * 60 : 0

    if (this.sessionWritesEnabled) {
      this.logger.log(
        `Session table: ${this.sessionTableName}, RYW TTL: ${ttlMinutes}m`,
      )
    } else {
      this.logger.log(
        `Session table: ${this.sessionTableName}, RYW session writes disabled (set RYW_SESSION_TTL_MINUTES to a positive number to enable)`,
      )
    }
  }

  /**
   * `true` when `RYW_SESSION_TTL_MINUTES` is set to a positive number.
   * If unset, optional env — no session writes after async publish.
   */
  isSessionWriteEnabled(): boolean {
    return this.sessionWritesEnabled
  }

  /**
   * Build session pk: {userId}#{tenantCode}
   */
  private buildPk(userId: string, tenantCode: string): string {
    return `${userId}${KEY_SEPARATOR}${tenantCode}`
  }

  /**
   * Build session sk: {moduleTableName}#{itemId}
   */
  private buildSk(moduleTableName: string, itemId: string): string {
    return `${moduleTableName}${KEY_SEPARATOR}${itemId}`
  }

  private calculateTtl(): number {
    return Math.floor(Date.now() / 1000) + this.ttlSeconds
  }

  /**
   * Write a session entry after a successful async command publish.
   * Called by CommandService after publishAsync only.
   */
  async put(
    userId: string,
    tenantCode: string,
    moduleTableName: string,
    itemId: string,
    version: number,
  ): Promise<void> {
    const item: SessionItem = {
      pk: this.buildPk(userId, tenantCode),
      sk: this.buildSk(moduleTableName, itemId),
      version,
      ttl: this.calculateTtl(),
    }
    this.logger.debug('session put::', item)
    await this.dynamoDbService.putItem(this.sessionTableName, item)
  }

  /**
   * Get a single session entry for a specific item.
   */
  async get(
    userId: string,
    tenantCode: string,
    moduleTableName: string,
    itemId: string,
  ): Promise<SessionItem | null> {
    const result = await this.dynamoDbService.getItem(this.sessionTableName, {
      pk: this.buildPk(userId, tenantCode),
      sk: this.buildSk(moduleTableName, itemId),
    })

    return (result as SessionItem) ?? null
  }

  /**
   * List session entries for a user scoped to a command module.
   *
   * Queries the session table by `{userId}#{tenantCode}` and filters to entries
   * whose sort key begins with `{moduleTableName}#`, returning only sessions
   * that belong to the given module.
   *
   * @param userId - The ID of the requesting user (from JWT `sub` claim).
   * @param tenantCode - The tenant the user is operating under.
   * @param moduleTableName - The `tableName` from `CommandModuleOptions` — used
   *   as the sort key prefix to scope results to a single command module.
   * @param limit - Maximum number of session entries to fetch. Defaults to
   *   `MAX_SESSION_ENTRIES` to prevent silent truncation from the underlying
   *   DynamoDB query's default limit of 10. Callers should rarely need to
   *   override this.
   * @returns The matching session entries, or an empty array if none exist or
   *   session writes are disabled.
   */
  async listByUser(
    userId: string,
    tenantCode: string,
    moduleTableName: string,
    limit = MAX_SESSION_ENTRIES,
  ): Promise<SessionItem[]> {
    const pk = this.buildPk(userId, tenantCode)
    const skPrefix = `${moduleTableName}${KEY_SEPARATOR}`

    const result = await this.dynamoDbService.listItemsByPk(
      this.sessionTableName,
      pk,
      {
        skExpression: 'begins_with(sk, :skPrefix)',
        skAttributeValues: { ':skPrefix': skPrefix },
      },
      undefined,
      limit,
    )

    return (result?.items as SessionItem[]) ?? []
  }
}
