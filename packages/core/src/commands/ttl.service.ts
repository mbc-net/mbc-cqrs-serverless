import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common'

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
    this.logger = new Logger(
      this.dynamoDbService.isStrictInline
        ? 'TtlService:strict-inline'
        : `${TtlService.name}:${this.options.tableName}`,
    )
  }

  async calculateTtl(
    type: TableType,
    tenantCode?: string,
    startDate?: Date,
  ): Promise<number | null> {
    const numberOfDay = await this.getTtlConfiguration(type, tenantCode)
    if (this.dynamoDbService.isStrictInline) {
      this.logger.debug('ttl.configuration.calculated')
    } else {
      this.logger.debug('numberOfDay', numberOfDay)
    }
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

      if (this.dynamoDbService.isStrictInline) {
        if (ttlData == null) return null
        if (
          typeof numberOfDay !== 'number' ||
          !Number.isSafeInteger(numberOfDay) ||
          numberOfDay <= 0
        ) {
          throw new ServiceUnavailableException(
            'TTL configuration is unavailable',
          )
        }
        return numberOfDay
      }

      return numberOfDay ? +numberOfDay : null
    } catch (error) {
      if (this.dynamoDbService.isStrictInline) {
        this.logger.error('ttl.configuration.unavailable')
        throw new ServiceUnavailableException(
          'TTL configuration is unavailable',
        )
      }
      this.logger.error('error', error)
      return null
    }
  }

  calculateUnixTime(days: number, startDate?: Date): number {
    if (
      this.dynamoDbService.isStrictInline &&
      (!Number.isSafeInteger(days) || days <= 0)
    ) {
      throw new ServiceUnavailableException('TTL configuration is unavailable')
    }
    if (days <= 0) {
      throw new Error('Number of days must be greater than 0.')
    }

    // Determine the base time in seconds
    const baseTimeInSeconds = startDate
      ? Math.floor(startDate.getTime() / 1000)
      : Math.floor(Date.now() / 1000)

    // Convert days to seconds and add to the base time
    const result = baseTimeInSeconds + days * 24 * 60 * 60

    if (this.dynamoDbService.isStrictInline && !Number.isSafeInteger(result)) {
      throw new ServiceUnavailableException('TTL configuration is unavailable')
    }

    return result
  }
}
