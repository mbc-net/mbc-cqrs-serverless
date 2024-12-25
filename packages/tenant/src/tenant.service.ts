import {
  DataEntity,
  DetailKey,
  DynamoDbService,
  getUserContext,
  IInvoke,
  KEY_SEPARATOR,
} from '@mbc-cqrs-serverless/core'
import { Injectable, Logger } from '@nestjs/common'

import { CreateTenantDto } from './dto/create.dto'
import { ITenantService } from './interfaces/tenant.service.interface'

@Injectable()
export class TenantService implements ITenantService {
  private readonly logger = new Logger(TenantService.name)
  private readonly tableName: string

  constructor(private readonly dynamoDbService: DynamoDbService) {
    this.tableName = dynamoDbService.getTableName('tenants')
    this.logger.debug('tableName: ' + this.tableName)
  }
  async getTenantCode(key: DetailKey): Promise<DataEntity> {
    return await this.dynamoDbService.getItem(this.tableName, key)
  }

  async createTenantCode(
    dto: CreateTenantDto,
    options: { invokeContext: IInvoke },
  ): Promise<DataEntity> {
    const { type, code, description } = dto
    const pk = `${type}${KEY_SEPARATOR}${code}`
    const sk = `SETTING`

    const sourceIp =
      options?.invokeContext?.event?.requestContext?.http?.sourceIp
    const userContext = getUserContext(options.invokeContext)
    const userId = userContext.userId || 'system'
    const now = new Date()
    const item = await this.dynamoDbService.updateItem(
      this.tableName,
      { pk, sk },
      {
        set: {
          code: sk,
          name: code,
          tenantCode: code,
          type: type,
          requestId: options.invokeContext?.context?.awsRequestId,
          createdAt: { ifNotExists: now },
          createdBy: { ifNotExists: userId },
          createdIp: { ifNotExists: sourceIp },
          updatedAt: now,
          updatedBy: userId,
          updatedIp: sourceIp,
          atttributes: {
            description: description,
          },
        },
      },
    )

    return item
  }
  updateTenantCode(): Promise<DataEntity> {
    throw new Error('Method not implemented.')
  }
  async deleteTenantCode(
    key: DetailKey,
    options: { invokeContext: IInvoke },
  ): Promise<DataEntity> {
    const { pk, sk } = key
    const sourceIp =
      options?.invokeContext?.event?.requestContext?.http?.sourceIp
    const userContext = getUserContext(options.invokeContext)
    const userId = userContext.userId || 'system'
    const now = new Date()
    const item = await this.dynamoDbService.updateItem(
      this.tableName,
      { pk, sk },
      {
        set: {
          isDeleted: true,
          createdIp: { ifNotExists: sourceIp },
          updatedAt: now,
          updatedBy: userId,
          updatedIp: sourceIp,
        },
      },
    )

    return item
  }
}
