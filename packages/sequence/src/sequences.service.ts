import { getCurrentInvoke } from '@codegenie/serverless-express'
import {
  DataEntity,
  DetailKey,
  DynamoDbService,
  getUserContext,
  KEY_SEPARATOR,
} from '@mbc-cqrs-severless/core'
import { Injectable, Logger } from '@nestjs/common'

import { GenSequenceDto } from './dto/gen-sequence.dto'
import { RotateByEnum } from './enums/rotate-by.enum'

@Injectable()
export class SequencesService {
  private readonly logger = new Logger(SequencesService.name)
  private readonly tableName: string

  constructor(private readonly dynamoDbService: DynamoDbService) {
    this.tableName = dynamoDbService.getTableName('sequences')
    this.logger.debug('tableName: ' + this.tableName)
  }

  async getCurrentSequence(key: DetailKey): Promise<DataEntity> {
    return await this.dynamoDbService.getItem(this.tableName, key)
  }

  /**
   * Seq data structure
   * - pk: SEQ#tenantCode
   * - sk: typeCode#rotateValue ( e.x: `user#20230401` )
   * - code: typeCode#rotateValue
   * - name: rotateBy ( e.x: `daily` )
   * - tenant_code: tenantCode
   * - type: typeCode
   * - seq: sequence value ( atomic counter )
   */
  async genNewSequence(dto: GenSequenceDto): Promise<DataEntity> {
    const rotateVal = this.getRotateValue(dto.rotateBy, dto.date)
    const pk = `SEQ${KEY_SEPARATOR}${dto.tenantCode}`
    const sk = `${dto.typeCode}${KEY_SEPARATOR}${rotateVal}`

    const { event, context } = getCurrentInvoke()
    const userContext = getUserContext(event)
    const now = new Date()
    const item = await this.dynamoDbService.updateItem(
      this.tableName,
      { pk, sk },
      {
        set: {
          code: sk,
          name: dto.rotateBy || 'none',
          tenantCode: dto.tenantCode,
          type: dto.typeCode,
          seq: { ifNotExists: 0, incrementBy: 1 },
          requestId: context?.awsRequestId,
          createdAt: { ifNotExists: now },
          createdBy: { ifNotExists: userContext.userId },
          createdIp: { ifNotExists: event?.requestContext?.http?.sourceIp },
          updatedAt: now,
          updatedBy: userContext.userId,
          updatedIp: event?.requestContext?.http?.sourceIp,
        },
      },
    )

    return item
  }

  private getRotateValue(rotateBy?: RotateByEnum, forDate?: Date) {
    const date = forDate || new Date()

    switch (rotateBy) {
      case RotateByEnum.FISCAL_YEARLY:
        const year = date.getFullYear()
        // new fiscal year from April
        return date.getMonth() < 3 ? year - 1 : year

      case RotateByEnum.YEARLY:
        return date.getFullYear().toString()

      case RotateByEnum.MONTHLY:
        return (
          date.getFullYear().toString() +
          (date.getMonth() + 1).toString().padStart(2, '0')
        )

      case RotateByEnum.DAILY:
        return (
          date.getFullYear().toString() +
          (date.getMonth() + 1).toString().padStart(2, '0') +
          date.getDate().toString().padStart(2, '0')
        )

      default:
        return RotateByEnum.NONE
    }
  }
}
