import {
  CommandDto,
  CommandModel,
  CommandService,
  DataEntity,
  DataService,
  DetailKey,
  generateId,
  getUserContext,
  IInvoke,
  KEY_SEPARATOR,
  VERSION_FIRST,
} from '@mbc-cqrs-serverless/core'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'

import {
  SETTING_TENANT_PREFIX,
  TENANT_SYSTEM_PREFIX,
} from './constants/tenant.constant'
import { CreateSettingDto } from './dto/settings/create.setting.dto'
import { CreateCommonTenantSettingDto } from './dto/settings/create-common.setting.dto'
import { CreateCroupSettingDto } from './dto/settings/create-group-setting.dto'
import { CreateUserSettingDto } from './dto/settings/create-user.setting.dto'
import { SettingEntity } from './entities/setting.entity'
import { SettingTypeEnum } from './enums/setting.enum'
import { ISettingService } from './interfaces/setting.service.interface'
@Injectable()
export class SettingService implements ISettingService {
  private readonly logger = new Logger(SettingService.name)

  constructor(
    private readonly commandService: CommandService,
    private readonly dataService: DataService,
  ) {}

  async getSetting(
    key: string,
    options: { invokeContext: IInvoke },
  ): Promise<SettingEntity> {
    const { tenantCode, tenantRole, userId } = getUserContext(
      options.invokeContext,
    )
    const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`

    // Try fetching user-level setting first
    let setting = await this.dataService.getItem({
      pk: pk,
      sk: `${SettingTypeEnum.TENANT_USER}${KEY_SEPARATOR}${userId}${KEY_SEPARATOR}${key}`,
    })

    if (setting) {
      return new SettingEntity({
        id: setting.id,
        settingValue: setting.attributes,
      })
    }

    // Fetch tenant settings
    const tenant = await this.dataService.getItem({
      pk: `${TENANT_SYSTEM_PREFIX}${KEY_SEPARATOR}${tenantCode}`,
      sk: SETTING_TENANT_PREFIX,
    })

    if (tenant?.attributes) {
      const groupSettingByRole = tenant.attributes.find(
        (i) => i.tenantRole === tenantRole,
      )

      if (groupSettingByRole) {
        setting = await this.getGroupSetting(
          groupSettingByRole.setting_groups,
          tenantCode,
          key,
        )
        if (setting) {
          return new SettingEntity({
            id: setting.id,
            settingValue: setting.attributes,
          })
        }
      }
    }

    // Fallback to common tenant-level settings
    setting = await this.dataService.getItem({
      pk: pk,
      sk: key,
    })

    if (setting) {
      return new SettingEntity({
        id: setting.id,
        settingValue: setting.attributes,
      })
    }

    setting = await this.dataService.getItem({
      pk: `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${SettingTypeEnum.TENANT_COMMON}`,
      sk: key,
    })

    return new SettingEntity({
      id: setting.id,
      settingValue: setting.attributes,
    })
  }

  async createCommonTenantSetting(
    dto: CreateCommonTenantSettingDto,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { name, attributes, code } = dto

    const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${SettingTypeEnum.TENANT_COMMON}`
    const sk = code

    const commad: CommandDto = {
      sk,
      pk,
      code: sk,
      name: name,
      id: generateId(pk, sk),
      tenantCode: SettingTypeEnum.TENANT_COMMON,
      type: SettingTypeEnum.TENANT_COMMON,
      version: VERSION_FIRST,

      attributes,
    }
    return await this.commandService.publishAsync(commad, options)
  }
  async createTenantSetting(
    dto: CreateSettingDto,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { name, tenantCode, attributes, code } = dto

    const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`
    const sk = code

    const commad: CommandDto = {
      sk,
      pk,
      code: sk,
      name: name,
      id: generateId(pk, sk),
      tenantCode: tenantCode,
      type: SettingTypeEnum.TENANT,
      version: VERSION_FIRST,

      attributes,
    }
    return await this.commandService.publishAsync(commad, options)
  }

  async createGroupSetting(
    dto: CreateCroupSettingDto,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { name, tenantCode, attributes, code, groupName } = dto

    const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`

    const sk = `${SettingTypeEnum.TENANT_GROUP}${KEY_SEPARATOR}${groupName}${KEY_SEPARATOR}${code}`

    const commad: CommandDto = {
      sk,
      pk,
      code: sk,
      name: name,
      id: generateId(pk, sk),
      tenantCode: tenantCode,
      type: SettingTypeEnum.TENANT_GROUP,
      version: VERSION_FIRST,

      attributes,
    }
    return await this.commandService.publishAsync(commad, options)
  }
  async createUserSetting(
    dto: CreateUserSettingDto,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { name, tenantCode, attributes, code, userId } = dto

    const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`

    const sk = `${SettingTypeEnum.TENANT_USER}${KEY_SEPARATOR}${userId}${KEY_SEPARATOR}${code}`

    const commad: CommandDto = {
      sk,
      pk,
      code: sk,
      name: name,
      id: generateId(pk, sk),
      tenantCode: tenantCode,
      type: SettingTypeEnum.TENANT_USER,
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

  private async getGroupSetting(
    groups: string[],
    tenantCode: string,
    settingId: string,
  ) {
    for (const key of groups) {
      const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`
      const sk = `${SettingTypeEnum.TENANT_GROUP}${KEY_SEPARATOR}${key}${KEY_SEPARATOR}${settingId}`
      const result = await this.dataService.getItem({
        pk: pk,
        sk: sk,
      })

      if (result) {
        return result // Return the first result found
      }
    }
    return null
  }
}
