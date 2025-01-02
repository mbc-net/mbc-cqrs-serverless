import {
  DetailKey,
  DynamoDbService,
  IMasterDataProvider,
  TableType,
} from '@mbc-cqrs-serverless/core'
import { Inject, Injectable, Optional } from '@nestjs/common'

import { DEFAULT_MASTER_DATA } from './constants/sequence.constant'

Injectable()
export class SequenceMasterDataProvider implements IMasterDataProvider {
  private tableName
  constructor(
    private readonly dynamoDbService: DynamoDbService,
    @Inject(DEFAULT_MASTER_DATA)
    @Optional()
    private readonly defaultValue: Record<string, any>,
  ) {
    this.tableName = dynamoDbService.getTableName('master', TableType.DATA)
  }
  async getData(key: DetailKey): Promise<any> {
    try {
      const item = await this.dynamoDbService.getItem(this.tableName, key)
      if (!item) {
        return this.defaultValue
      }
      return item.attributes
    } catch (error) {
      return this.defaultValue
    }
  }
}
