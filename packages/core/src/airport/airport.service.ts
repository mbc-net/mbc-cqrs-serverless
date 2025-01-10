import { Injectable } from '@nestjs/common'
import { DynamoDB } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { AirportDataEntity } from './entity/airport-data.entity'
import { airportToExternal } from './helpers/airport-serialization.helper'

@Injectable()
export class AirportService {
  private readonly dynamodb: DynamoDB
  private readonly tableName: string

  constructor() {
    this.dynamodb = new DynamoDB({
      region: process.env.AWS_REGION || 'ap-northeast-1'
    })
    this.tableName = process.env.DYNAMODB_TABLE || 'mbc-cqrs-serverless-data'
  }

  /**
   * ICAO コードで空港データを取得する
   * @param icao ICAO コード
   * @returns 空港データ（外部形式）
   */
  async findByIcao(icao: string): Promise<Record<string, any> | null> {
    try {
      const result = await this.dynamodb.getItem({
        TableName: this.tableName,
        Key: {
          pk: { S: 'AIRPORT' },
          sk: { S: icao }
        }
      })

      if (!result.Item) {
        return null
      }

      const item = unmarshall(result.Item)
      const airport = new AirportDataEntity(item)
      return airportToExternal(airport)
    } catch (error) {
      console.error('Failed to fetch airport:', error)
      throw error
    }
  }
}
