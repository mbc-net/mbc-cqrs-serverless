import { Inject, Injectable, Logger } from '@nestjs/common'

import { DynamoDbService } from '../data-store/dynamodb.service'
import { addSortKeyVersion } from '../helpers'
import { CommandModuleOptions, DataModel, DetailKey } from '../interfaces'
import { MODULE_OPTIONS_TOKEN } from './command.module-definition'
import { DataService } from './data.service'

const TABLE_NAME = Symbol('history')

@Injectable()
export class HistoryService {
  private logger: Logger
  private [TABLE_NAME]: string

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: CommandModuleOptions,
    private readonly dynamoDbService: DynamoDbService,
    private readonly dataService: DataService,
  ) {
    this.tableName = this.dynamoDbService.getTableName(
      this.options.tableName,
      'history',
    )
    this.logger = new Logger(`${HistoryService.name}:${this.tableName}`)
  }

  set tableName(name: string) {
    this[TABLE_NAME] = name
  }

  get tableName(): string {
    return this[TABLE_NAME]
  }

  async publish(key: DetailKey) {
    const data = await this.dataService.getItem(key)
    if (!data) {
      return null
    }
    data.sk = addSortKeyVersion(data.sk, data.version)

    this.logger.debug('publish::', data)
    return await this.dynamoDbService.putItem(this.tableName, data)
  }

  async getItem(key: DetailKey): Promise<DataModel> {
    return await this.dynamoDbService.getItem(this.tableName, key)
  }
}
