import { Inject, Injectable, Logger } from '@nestjs/common'

import { DynamoDbService } from '../data-store/dynamodb.service'
import { masterPk, ttlSk } from '../helpers'
import { CommandModuleOptions, ITtlService } from '../interfaces'
import { MODULE_OPTIONS_TOKEN } from './command.module-definition'
import { TableType } from './enums'

@Injectable()
export class TtlService implements ITtlService {
  private logger: Logger

  constructor(
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: CommandModuleOptions,
    private readonly dynamoDbService: DynamoDbService,
  ) {
    this.logger = new Logger(`${TtlService.name}:${this.options.tableName}`)
  }

  async calculateTtl(
    type: TableType,
    tenantCode?: string,
    startDate?: Date,
  ): Promise<number | null> {
    const numberOfDay = await this.getTtlConfiguration(type, tenantCode)
    this.logger.log('numberOfDay', numberOfDay)
    return numberOfDay ? this.calculateUnixTime(numberOfDay, startDate) : null
  }

  async getTtlConfiguration(
    type: TableType,
    tenantCode?: string,
  ): Promise<number | null> {
    try {
      const masterDataTableName = this.dynamoDbService.getTableName(
        'master',
        TableType.DATA,
      )

      const pk = masterPk(tenantCode)
      const sk = ttlSk(
        this.dynamoDbService.getTableName(this.options.tableName, type),
      )

      const ttlData = await this.dynamoDbService.getItem(masterDataTableName, {
        pk,
        sk,
      })

      const numberOfDay = ttlData?.attributes?.days // pk | sk | attributes {days: 90}

      return numberOfDay ? +numberOfDay : null
    } catch (error) {
      this.logger.error('error', error)
      return null
    }
  }

  calculateUnixTime(days: number, startDate?: Date): number {
    if (days <= 0) {
      throw new Error('Number of days must be greater than 0.')
    }

    // Determine the base time in seconds
    const baseTimeInSeconds = startDate
      ? Math.floor(startDate.getTime() / 1000)
      : Math.floor(Date.now() / 1000)

    // Convert days to seconds and add to the base time
    const result = baseTimeInSeconds + days * 24 * 60 * 60

    return result
  }
}
