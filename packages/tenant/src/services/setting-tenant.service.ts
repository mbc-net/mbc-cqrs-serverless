import {
  CommandDto,
  CommandModel,
  CommandService,
  DataService,
  DetailKey,
  generateId,
  getUserContext,
  IInvoke,
  KEY_SEPARATOR,
  VERSION_FIRST,
} from '@mbc-cqrs-serverless/core'
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'

import {
  SETTING_TENANT_PREFIX,
  TENANT_SYSTEM_PREFIX,
} from '../constants/tenant.constant'
import { CreateSettingDto } from '../dto/settings/create.setting.dto'
import { CreateCommonTenantSettingDto } from '../dto/settings/create-common.setting.dto'
import { CreateCroupSettingDto } from '../dto/settings/create-group-setting.dto'
import { CreateUserSettingDto } from '../dto/settings/create-user.setting.dto'
import { GetSettingDto } from '../dto/settings/get-setting.dto'
import { UpdateSettingDto } from '../dto/settings/update.setting.dto'
import { SettingEntity } from '../entities/setting.entity'
import { SettingTypeEnum } from '../enums/setting.enum'
import { ISettingService } from '../interfaces/setting.service.interface'

@Injectable()
export class SettingTenantService implements ISettingService {
  private readonly logger = new Logger(SettingTenantService.name)

  constructor(
    private readonly commandService: CommandService,
    private readonly dataService: DataService,
  ) {}

  async getSetting(
    dto: GetSettingDto,
    options: { invokeContext: IInvoke },
  ): Promise<SettingEntity> {
    const { tenantCode, tenantRole, userId } = getUserContext(
      options.invokeContext,
    )
    const { code, type } = dto
    const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`

    // Try fetching user-level setting first
    let setting = await this.dataService.getItem({
      pk: pk,
      sk: `${SettingTypeEnum.TENANT_USER}${KEY_SEPARATOR}${userId}${KEY_SEPARATOR}${type}${KEY_SEPARATOR}${code}`,
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

    if (tenant?.attributes?.setting) {
      const groupSettingByRole = tenant.attributes.setting.find(
        (i) => i.tenantRole === tenantRole,
      )

      if (groupSettingByRole) {
        setting = await this.getGroupSetting(
          groupSettingByRole.setting_groups,
          tenantCode,
          type,
          code,
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
      sk: `${type}${KEY_SEPARATOR}${code}`,
    })

    if (setting) {
      return new SettingEntity({
        id: setting.id,
        settingValue: setting.attributes,
      })
    }

    setting = await this.dataService.getItem({
      pk: `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${SettingTypeEnum.TENANT_COMMON}`,
      sk: `${type}${KEY_SEPARATOR}${code}`,
    })
    if (!setting) {
      throw new NotFoundException()
    }

    return new SettingEntity({
      id: setting.id,
      settingValue: setting.attributes,
    })
  }

  async createCommonTenantSetting(
    dto: CreateCommonTenantSettingDto,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { name, settingValue, code, type } = dto

    const tenantPK = `${TENANT_SYSTEM_PREFIX}${KEY_SEPARATOR}${SettingTypeEnum.TENANT_COMMON}`
    const tenantSK = SETTING_TENANT_PREFIX
    const tenant = await this.dataService.getItem({
      pk: tenantPK,
      sk: tenantSK,
    })
    if (!tenant) {
      throw new BadRequestException('Tenant not exist')
    }

    const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${SettingTypeEnum.TENANT_COMMON}`
    const sk = `${type}${KEY_SEPARATOR}${code}`
    const commad: CommandDto = {
      sk,
      pk,
      code: sk,
      name: name,
      id: generateId(pk, sk),
      tenantCode: SettingTypeEnum.TENANT_COMMON,
      type: type,
      version: VERSION_FIRST,

      attributes: settingValue,
    }
    return await this.commandService.publishAsync(commad, options)
  }
  async createTenantSetting(
    dto: CreateSettingDto,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { name, tenantCode, settingValue, code, type } = dto
    const tenantPK = `${TENANT_SYSTEM_PREFIX}${KEY_SEPARATOR}${tenantCode}`
    const tenantSK = SETTING_TENANT_PREFIX

    const tenant = await this.dataService.getItem({
      pk: tenantPK,
      sk: tenantSK,
    })
    if (!tenant) {
      throw new BadRequestException('Tenant not exist')
    }

    const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`
    const sk = `${type}${KEY_SEPARATOR}${code}`

    const commad: CommandDto = {
      sk,
      pk,
      code: sk,
      name: name,
      id: generateId(pk, sk),
      tenantCode: tenantCode,
      type: type,
      version: VERSION_FIRST,

      attributes: settingValue,
    }
    return await this.commandService.publishAsync(commad, options)
  }

  async createGroupSetting(
    dto: CreateCroupSettingDto,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { name, tenantCode, settingValue, code, groupName, type } = dto

    const tenantPK = `${TENANT_SYSTEM_PREFIX}${KEY_SEPARATOR}${tenantCode}`
    const tenantSK = SETTING_TENANT_PREFIX

    const tenant = await this.dataService.getItem({
      pk: tenantPK,
      sk: tenantSK,
    })
    if (!tenant) {
      throw new BadRequestException('Tenant not exist')
    }

    const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`

    const sk = `${SettingTypeEnum.TENANT_GROUP}${KEY_SEPARATOR}${groupName}${KEY_SEPARATOR}${type}${KEY_SEPARATOR}${code}`

    const commad: CommandDto = {
      sk,
      pk,
      code: sk,
      name: name,
      id: generateId(pk, sk),
      tenantCode: tenantCode,
      type: type,
      version: VERSION_FIRST,

      attributes: settingValue,
    }
    return await this.commandService.publishAsync(commad, options)
  }
  async createUserSetting(
    dto: CreateUserSettingDto,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { name, tenantCode, settingValue, code, userId, type } = dto
    const tenantPK = `${TENANT_SYSTEM_PREFIX}${KEY_SEPARATOR}${tenantCode}`
    const tenantSK = SETTING_TENANT_PREFIX

    const tenant = await this.dataService.getItem({
      pk: tenantPK,
      sk: tenantSK,
    })
    if (!tenant) {
      throw new BadRequestException('Tenant not exist')
    }

    const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`

    const sk = `${SettingTypeEnum.TENANT_USER}${KEY_SEPARATOR}${userId}${KEY_SEPARATOR}${type}${KEY_SEPARATOR}${code}`

    const commad: CommandDto = {
      sk,
      pk,
      code: sk,
      name: name,
      id: generateId(pk, sk),
      tenantCode: tenantCode,
      type: type,
      version: VERSION_FIRST,

      attributes: settingValue,
    }
    return await this.commandService.publishAsync(commad, options)
  }

  async updateSetting(
    key: DetailKey,
    dto: UpdateSettingDto,
    context: { invokeContext: IInvoke },
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
        name: dto.name,
        attributes: dto.settingValue,
        version: data.version,
      },
      context,
    )
    return item
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
    type: string,
    code: string,
  ) {
    for (const key of groups) {
      const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`
      const sk = `${SettingTypeEnum.TENANT_GROUP}${KEY_SEPARATOR}${key}${KEY_SEPARATOR}${type}${KEY_SEPARATOR}${code}`
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
