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
  TENANT_SK,
  TENANT_SYSTEM_PREFIX,
} from '../constants/tenant.constant'
import { CreateSettingDto } from '../dto/settings/create.setting.dto'
import { CreateCommonTenantSettingDto } from '../dto/settings/create-common.setting.dto'
import { CreateCroupSettingDto } from '../dto/settings/create-group-setting.dto'
import { CreateUserSettingDto } from '../dto/settings/create-user.setting.dto'
import { GetListSettingDto } from '../dto/settings/get-list-setting.dto'
import { GetSettingDto } from '../dto/settings/get-setting.dto'
import { UpdateSettingDto } from '../dto/settings/update.setting.dto'
import { SettingEntity } from '../entities/setting.entity'
import { SettingListEntity } from '../entities/setting-list.entity'
import { SettingTypeEnum } from '../enums/setting.enum'
import { ISettingService } from '../interfaces/setting.service.interface'

@Injectable()
export class SettingTenantService implements ISettingService {
  private readonly logger = new Logger(SettingTenantService.name)

  constructor(
    private readonly commandService: CommandService,
    private readonly dataService: DataService,
  ) {}

  private async fetchSetting(
    pk: string,
    skPrefix: string,
    type: string,
    code?: string,
  ): Promise<any> {
    const sk = code
      ? `${skPrefix}${type}${KEY_SEPARATOR}${code}`
      : skPrefix + type
    return code
      ? this.dataService.getItem({ pk, sk })
      : this.dataService.listItemsByPk(pk, { startFromSk: sk })
  }

  private mapSettings(settings: any[]): SettingEntity[] {
    return settings.map(
      (item) =>
        new SettingEntity({
          id: item.id,
          settingValue: item.attributes,
        }),
    )
  }

  private async fetchGroupSetting(
    groups: string[],
    tenantCode: string,
    type: string,
    code?: string,
  ): Promise<any> {
    const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`
    for (const group of groups) {
      const skPrefix = `${SettingTypeEnum.TENANT_GROUP}${KEY_SEPARATOR}${group}${KEY_SEPARATOR}`
      const result = await this.fetchSetting(pk, skPrefix, type, code)
      if (result) return result
    }
    return null
  }

  async getSetting(
    dto: GetSettingDto,
    options: { invokeContext: IInvoke },
  ): Promise<SettingEntity> {
    const { tenantCode, tenantRole, userId } = getUserContext(
      options.invokeContext,
    )
    const { code, type } = dto
    const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`

    // Fetch user-level setting
    let setting = await this.fetchSetting(
      pk,
      `${SettingTypeEnum.TENANT_USER}${KEY_SEPARATOR}${userId}${KEY_SEPARATOR}`,
      type,
      code,
    )

    if (setting) {
      return new SettingEntity({
        id: setting.id,
        settingValue: setting.attributes,
      })
    }

    // Fetch tenant-level group settings
    const tenant = await this.dataService.getItem({
      pk: `${TENANT_SYSTEM_PREFIX}${KEY_SEPARATOR}${tenantCode}`,
      sk: SETTING_TENANT_PREFIX,
    })

    if (tenant?.attributes?.setting) {
      const groupSettingByRole = tenant.attributes.setting.find(
        (i) => i.tenantRole === tenantRole,
      )

      if (groupSettingByRole) {
        setting = await this.fetchGroupSetting(
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
    setting = await this.fetchSetting(pk, '', type, code)
    if (setting) {
      return new SettingEntity({
        id: setting.id,
        settingValue: setting.attributes,
      })
    }

    setting = await this.fetchSetting(
      `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${SettingTypeEnum.TENANT_COMMON}`,
      '',
      type,
      code,
    )
    if (!setting) {
      this.logger.error(`Setting not found ${code}`)
      throw new BadRequestException()
    }

    return new SettingEntity({
      id: setting.id,
      settingValue: setting.attributes,
    })
  }

  async getListSetting(
    dto: GetListSettingDto,
    context: { invokeContext: IInvoke },
  ): Promise<SettingListEntity> {
    const { tenantCode, tenantRole, userId } = getUserContext(
      context.invokeContext,
    )
    const { type } = dto
    const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`

    // Fetch user-level settings
    let settings = await this.fetchSetting(
      pk,
      `${SettingTypeEnum.TENANT_USER}${KEY_SEPARATOR}${userId}${KEY_SEPARATOR}`,
      type,
    )
    if (settings?.items.length) {
      return new SettingListEntity({ items: this.mapSettings(settings.items) })
    }

    // Fetch tenant-level group settings
    const tenant = await this.dataService.getItem({
      pk: `${TENANT_SYSTEM_PREFIX}${KEY_SEPARATOR}${tenantCode}`,
      sk: SETTING_TENANT_PREFIX,
    })

    if (tenant?.attributes?.setting) {
      const groupSettingByRole = tenant.attributes.setting.find(
        (i) => i.tenantRole === tenantRole,
      )

      if (groupSettingByRole) {
        settings = await this.fetchGroupSetting(
          groupSettingByRole.setting_groups,
          tenantCode,
          type,
        )
        if (settings?.items.length) {
          return new SettingListEntity({
            items: this.mapSettings(settings.items),
          })
        }
      }
    }

    // Fallback to common tenant-level settings
    settings = await this.fetchSetting(pk, '', type)
    if (settings?.items.length) {
      return new SettingListEntity({ items: this.mapSettings(settings.items) })
    }

    settings = await this.fetchSetting(
      `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${SettingTypeEnum.TENANT_COMMON}`,
      '',
      type,
    )

    if (!settings?.items.length) {
      this.logger.error(`Setting not found`)
      throw new BadRequestException()
    }

    return new SettingListEntity({ items: this.mapSettings(settings.items) })
  }

  async createCommonTenantSetting(
    dto: CreateCommonTenantSettingDto,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { name, settingValue, code, type } = dto

    const tenantPK = `${TENANT_SYSTEM_PREFIX}${KEY_SEPARATOR}${SettingTypeEnum.TENANT_COMMON}`
    const tenantSK = TENANT_SK
    const tenant = await this.dataService.getItem({
      pk: tenantPK,
      sk: tenantSK,
    })
    if (!tenant) {
      this.logger.error(`Tenant not exist ${SettingTypeEnum.TENANT_COMMON}`)
      throw new BadRequestException('Tenant not exist')
    }

    const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${SettingTypeEnum.TENANT_COMMON}`
    const sk = `${type}${KEY_SEPARATOR}${code}`
    const command: CommandDto = {
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
    return await this.commandService.publishAsync(command, options)
  }
  async createTenantSetting(
    dto: CreateSettingDto,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { name, tenantCode, settingValue, code, type } = dto
    const tenantPK = `${TENANT_SYSTEM_PREFIX}${KEY_SEPARATOR}${tenantCode}`
    const tenantSK = TENANT_SK

    const tenant = await this.dataService.getItem({
      pk: tenantPK,
      sk: tenantSK,
    })
    if (!tenant) {
      this.logger.error(`Tenant not exist ${tenantCode}`)
      throw new BadRequestException('Tenant not exist')
    }

    const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`
    const sk = `${type}${KEY_SEPARATOR}${code}`

    const command: CommandDto = {
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
    return await this.commandService.publishAsync(command, options)
  }

  async createGroupSetting(
    dto: CreateCroupSettingDto,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { name, tenantCode, settingValue, code, groupName, type } = dto

    const tenantPK = `${TENANT_SYSTEM_PREFIX}${KEY_SEPARATOR}${tenantCode}`
    const tenantSK = TENANT_SK

    const tenant = await this.dataService.getItem({
      pk: tenantPK,
      sk: tenantSK,
    })
    if (!tenant) {
      throw new BadRequestException('Tenant not exist')
    }

    const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`

    const sk = `${SettingTypeEnum.TENANT_GROUP}${KEY_SEPARATOR}${groupName}${KEY_SEPARATOR}${type}${KEY_SEPARATOR}${code}`

    const command: CommandDto = {
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
    return await this.commandService.publishAsync(command, options)
  }
  async createUserSetting(
    dto: CreateUserSettingDto,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { name, tenantCode, settingValue, code, userId, type } = dto
    const tenantPK = `${TENANT_SYSTEM_PREFIX}${KEY_SEPARATOR}${tenantCode}`
    const tenantSK = TENANT_SK

    const tenant = await this.dataService.getItem({
      pk: tenantPK,
      sk: tenantSK,
    })
    if (!tenant) {
      throw new BadRequestException('Tenant not exist')
    }

    const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`

    const sk = `${SettingTypeEnum.TENANT_USER}${KEY_SEPARATOR}${userId}${KEY_SEPARATOR}${type}${KEY_SEPARATOR}${code}`

    const command: CommandDto = {
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
    return await this.commandService.publishAsync(command, options)
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
}
