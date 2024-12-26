import {
  CommandDto,
  CommandModel,
  CommandService,
  DataEntity,
  DataModel,
  DataService,
  DetailKey,
  generateId,
  IInvoke,
  KEY_SEPARATOR,
  VERSION_FIRST,
} from '@mbc-cqrs-serverless/core'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'

import { CreateSettingByTenantDto } from './dto/settings/create.setting.dto'
import { SettingTypeEnum } from './enums/setting.enum'
import { ISettingService } from './interfaces/setting.service.interface'
@Injectable()
export class SettingService implements ISettingService {
  private readonly logger = new Logger(SettingService.name)

  constructor(
    private readonly commandService: CommandService,
    private readonly dataService: DataService,
  ) {}
  async getSetting(key: DetailKey): Promise<DataModel> {
    return await this.dataService.getItem(key)
  }

  async createSetting(
    dto: CreateSettingByTenantDto,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { name, tenantCode, attributes, entityIdentifier, type, code } = dto

    const basePk = `SETTING${KEY_SEPARATOR}${tenantCode || SettingTypeEnum.TENANT_COMMON}`
    let pk = basePk

    if (
      type === SettingTypeEnum.TENANT_GROUP ||
      type === SettingTypeEnum.TENANT_USER
    ) {
      pk += `${KEY_SEPARATOR}${type}${KEY_SEPARATOR}${entityIdentifier}`
    }

    const sk = code

    const commad: CommandDto = {
      sk,
      pk,
      code: sk,
      name: name,
      id: generateId(pk, sk),
      tenantCode: tenantCode || SettingTypeEnum.TENANT_COMMON,
      type: type,
      version: VERSION_FIRST,

      attributes,
    }
    return await this.commandService.publishAsync(commad, options)
  }

  updateSetting(): Promise<DataEntity> {
    throw new Error('Method not implemented.')
  }

  async deleteSetting(
    key: DetailKey,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { pk, sk } = key
    const data = await this.dataService.getItem(key)
    if (!data) {
      throw new NotFoundException()
    }

    const item = await this.commandService.publishPartialUpdateAsync(
      {
        pk,
        sk,
        version: data.version,
        isDeleted: true,
      },
      options,
    )

    return item
  }
}
