import { Inject, Injectable, Logger } from '@nestjs/common'

import { DynamoDbService } from '../data-store/dynamodb.service'
import { removeSortKeyVersion } from '../helpers/key'
import {
  CommandModel,
  CommandModuleOptions,
  DataEntity,
  DataListEntity,
  DataModel,
  DetailKey,
} from '../interfaces'
import { MODULE_OPTIONS_TOKEN } from './command.module-definition'
import { TableType } from './enums'

const TABLE_NAME = Symbol('data')

/**
 * Service for reading data from DynamoDB.
 * Provides query operations for the read side of CQRS.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class OrderService {
 *   constructor(
 *     @InjectDataService() private readonly dataService: DataService
 *   ) {}
 *
 *   async getOrder(pk: string, sk: string) {
 *     return this.dataService.getItem({ pk, sk });
 *   }
 * }
 * ```
 */
@Injectable()
export class DataService {
  private logger: Logger
  private [TABLE_NAME]: string

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: CommandModuleOptions,
    private readonly dynamoDbService: DynamoDbService,
  ) {
    this.tableName = this.dynamoDbService.getTableName(
      this.options.tableName,
      TableType.DATA,
    )
    this.logger = new Logger(`${DataService.name}:${this.tableName}`)
  }

  set tableName(name: string) {
    this[TABLE_NAME] = name
  }

  get tableName(): string {
    return this[TABLE_NAME]
  }

  /**
   * Publishes command data to the data table.
   * Updates or creates the data record based on the command.
   *
   * @param cmd - The command model to publish
   * @returns The published data model
   */
  async publish(cmd: CommandModel) {
    const pk = cmd.pk
    const sk = removeSortKeyVersion(cmd.sk)
    const data = await this.getItem({ pk, sk })
    const dataModel: DataModel = {
      ...data,
      pk,
      sk,
      id: cmd.id,
      code: cmd.code,
      name: cmd.name,
      version: cmd.version,
      tenantCode: cmd.tenantCode,
      type: cmd.type,
      seq: cmd.seq,
      attributes: cmd.attributes,
      cpk: cmd.pk,
      csk: cmd.sk,
      isDeleted: cmd.isDeleted,
      ttl: cmd.ttl,
      requestId: cmd.requestId,
      createdAt: data?.createdAt || cmd.createdAt,
      updatedAt: cmd.updatedAt,
      createdBy: data?.createdBy || cmd.createdBy,
      updatedBy: cmd.updatedBy,
      createdIp: data?.createdIp || cmd.createdIp,
      updatedIp: cmd.updatedIp,
    }

    this.logger.debug('publish::', dataModel)
    await this.dynamoDbService.putItem(this.tableName, dataModel)

    return dataModel
  }

  /**
   * Retrieves a single item from the data table.
   *
   * @param key - The partition key and sort key
   * @returns The data model or undefined if not found
   */
  async getItem(key: DetailKey): Promise<DataModel> {
    return await this.dynamoDbService.getItem(this.tableName, key)
  }

  /**
   * Lists items by partition key with optional filtering and pagination.
   *
   * @param pk - The partition key to query
   * @param opts - Optional query parameters
   * @param opts.sk - Sort key filter expression
   * @param opts.startFromSk - Start key for pagination
   * @param opts.limit - Maximum number of items to return
   * @param opts.order - Sort order ('asc' or 'desc')
   * @returns List of data entities with pagination info
   */
  async listItemsByPk(
    pk: string,
    opts?: {
      sk?: {
        skExpession: string
        skAttributeValues: Record<string, string>
        skAttributeNames?: Record<string, string>
      }
      startFromSk?: string
      limit?: number
      order?: 'asc' | 'desc'
    },
  ): Promise<DataListEntity> {
    const { lastSk, items } = await this.dynamoDbService.listItemsByPk(
      this.tableName,
      pk,
      opts?.sk,
      opts?.startFromSk,
      opts?.limit,
      opts?.order,
    )

    return new DataListEntity({
      lastSk,
      items: items.map((item) => new DataEntity(item)),
    })
  }
}
