import {
  DetailKey,
  DynamoDbService,
  IMasterDataProvider,
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
    this.tableName = dynamoDbService.getTableName('master', 'data')
  }
  async getData(key: DetailKey): Promise<any> {
    try {
      const item = await this.dynamoDbService.getItem(this.tableName, key)
      if (!item) {
        return this.defaultValue
      }
      return item
    } catch (error) {
      return this.defaultValue
    }
  }
}
