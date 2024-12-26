import {
  DataEntity,
  DetailKey,
  DynamoDbService,
  getUserContext,
  IInvoke,
  KEY_SEPARATOR,
} from '@mbc-cqrs-serverless/core'
import { Injectable, Logger } from '@nestjs/common'

import { CreateSettingByTenantDto } from './dto/settings/create.setting.dto'
import { ISettingService } from './interfaces/setting.service.interface'
@Injectable()
export class SettingService implements ISettingService {
  private readonly logger = new Logger(SettingService.name)
  private readonly tableName: string

  constructor(private readonly dynamoDbService: DynamoDbService) {
    this.tableName = dynamoDbService.getTableName('tenants')
    this.logger.debug('tableName: ' + this.tableName)
  }
  async getSetting(key: DetailKey): Promise<DataEntity> {
    return await this.dynamoDbService.getItem(this.tableName, key)
  }

  async createSetting(
    dto: CreateSettingByTenantDto,
    options: { invokeContext: IInvoke },
  ): Promise<DataEntity> {
    const { name, tenantCode, attributes } = dto
    const pk = `${tenantCode}${KEY_SEPARATOR}${name}`
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
          name: name,
          tenantCode: tenantCode,
          type: name,
          requestId: options.invokeContext?.context?.awsRequestId,
          createdAt: { ifNotExists: now },
          createdBy: { ifNotExists: userId },
          createdIp: { ifNotExists: sourceIp },
          updatedAt: now,
          updatedBy: userId,
          updatedIp: sourceIp,
          atttributes: attributes,
        },
      },
    )

    return item
  }
  updateSetting(): Promise<DataEntity> {
    throw new Error('Method not implemented.')
  }
  async deleteSetting(
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
