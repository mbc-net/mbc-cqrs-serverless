import {
  CommandDto,
  CommandModel,
  CommandService,
  DataModel,
  DataService,
  DetailKey,
  generateId,
  IInvoke,
  KEY_SEPARATOR,
  VERSION_FIRST,
} from '@mbc-cqrs-serverless/core'
import { BadRequestException } from '@nestjs/common'
import { Injectable, Logger } from '@nestjs/common'

import { TENANT_SK, TENANT_SYSTEM_PREFIX } from '../constants/tenant.constant'
import {
  CommonTenantCreateDto,
  TenantCreateDto,
  TenantGroupAddDto,
  TenantGroupUpdateDto,
  TenantUpdateDto,
} from '../dto'
import { SettingTypeEnum } from '../enums/setting.enum'
import { ITenantService } from '../interfaces/tenant.service.interface'

@Injectable()
export class TenantService implements ITenantService {
  private readonly logger = new Logger(TenantService.name)

  constructor(
    private readonly commandService: CommandService,
    private readonly dataService: DataService,
  ) {}

  async getTenant(key: DetailKey): Promise<DataModel> {
    return await this.dataService.getItem(key)
  }

  async createCommonTenant(
    dto: CommonTenantCreateDto,
    context: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { name, attributes } = dto
    const pk = `${TENANT_SYSTEM_PREFIX}${KEY_SEPARATOR}${SettingTypeEnum.TENANT_COMMON}`
    const sk = TENANT_SK

    const tenant = await this.dataService.getItem({
      pk,
      sk,
    })
    if (tenant) {
      throw new BadRequestException(
        `Tenant already exist: ${SettingTypeEnum.TENANT_COMMON}`,
      )
    }

    const command: CommandDto = {
      pk: pk,
      sk: sk,
      code: sk,
      id: generateId(pk, sk),
      name: name,
      tenantCode: SettingTypeEnum.TENANT_COMMON,
      type: SettingTypeEnum.TENANT_COMMON,
      version: VERSION_FIRST,
      attributes: attributes,
    }
    return await this.commandService.publishAsync(command, context)
  }
  async createTenant(
    dto: TenantCreateDto,
    context: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { name, code, attributes } = dto
    const pk = `${TENANT_SYSTEM_PREFIX}${KEY_SEPARATOR}${code}`
    const sk = TENANT_SK

    const tenant = await this.dataService.getItem({
      pk,
      sk,
    })
    if (tenant) {
      throw new BadRequestException(
        `Tenant already exist: ${SettingTypeEnum.TENANT_COMMON}`,
      )
    }

    const command: CommandDto = {
      pk: pk,
      sk: sk,
      code: sk,
      id: generateId(pk, sk),
      name: name,
      tenantCode: code,
      type: code,
      version: VERSION_FIRST,
      attributes: attributes,
    }

    return await this.commandService.publishAsync(command, context)
  }

  async updateTenant(
    key: DetailKey,
    dto: TenantUpdateDto,
    context: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { pk, sk } = key
    const data = await this.dataService.getItem(key)
    if (!data) {
      throw new BadRequestException(
        `Tenant not found for update: ${JSON.stringify(key)}`,
      )
    }
    const item = await this.commandService.publishPartialUpdateAsync(
      {
        pk,
        sk,
        name: dto.name,
        attributes: dto.attributes,
        version: data.version,
      },
      context,
    )
    return item
  }
  async deleteTenant(
    key: DetailKey,
    context: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const data = await this.dataService.getItem(key)
    if (!data) {
      throw new BadRequestException(
        `Tenant not found for delete: ${JSON.stringify(key)}`,
      )
    }
    const { pk, sk } = key

    const item = await this.commandService.publishPartialUpdateAsync(
      {
        pk,
        sk,
        version: data.version,
        isDeleted: true,
      },
      context,
    )

    return item
  }
  async addTenantGroup(
    dto: TenantGroupAddDto,
    context: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { role, groupId, tenantCode } = dto

    const tenant = await this.dataService.getItem({
      pk: `${TENANT_SYSTEM_PREFIX}${KEY_SEPARATOR}${tenantCode}`,
      sk: TENANT_SK,
    })
    if (!tenant) {
      this.logger.error(`Tenant not found for addGroup: ${tenantCode}`)
      throw new BadRequestException('Tenant not found')
    }

    // Helper to create a new attribute
    const createNewAttribute = () => ({
      tenantRole: role,
      groups: [groupId],
      setting_groups: [groupId],
      setting_groups_mode: 'auto',
    })

    // Helper to update an existing attribute
    const updateAttribute = (item) => {
      if (item.groups.includes(groupId)) return item

      const newGroups = [...item.groups, groupId]
      const newSettingGroups =
        item.setting_groups_mode === 'customized'
          ? [...item.setting_groups, groupId]
          : this.sortGroups(newGroups)

      return {
        ...item,
        groups: newGroups,
        setting_groups: newSettingGroups,
        setting_groups_mode: item.setting_groups_mode || 'auto',
      }
    }

    // If tenant exists and has attributes
    if (
      Array.isArray(tenant?.attributes?.setting) &&
      tenant.attributes.setting.length > 0
    ) {
      const existingRole = tenant.attributes.setting.find(
        (i) => i.tenantRole === role,
      )

      const updatedAttributes = existingRole
        ? tenant.attributes.setting.map((item) =>
            item.tenantRole === role ? updateAttribute(item) : item,
          )
        : [...tenant.attributes.setting, createNewAttribute()]

      return await this.commandService.publishPartialUpdateAsync(
        {
          pk: tenant.pk,
          sk: tenant.sk,
          version: tenant.version,
          attributes: {
            setting: updatedAttributes,
          },
        },
        context,
      )
    }
    // If tenant does not exist or has no attributes
    return await this.commandService.publishPartialUpdateAsync(
      {
        pk: tenant.pk,
        sk: tenant.sk,
        version: tenant.version,
        attributes: {
          setting: [createNewAttribute()],
        },
      },
      context,
    )
  }

  async customizeSettingGroups(
    dto: TenantGroupUpdateDto,
    context: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { role, settingGroups, tenantCode } = dto

    const tenant = await this.dataService.getItem({
      pk: `${TENANT_SYSTEM_PREFIX}${KEY_SEPARATOR}${tenantCode}`,
      sk: TENANT_SK,
    })
    if (!tenant) {
      this.logger.error(
        `Tenant not found for customizeSettingGroups: ${tenantCode}`,
      )
      throw new BadRequestException(
        `Tenant not found for key: ${JSON.stringify(tenantCode)}`,
      )
    }

    const settings = tenant.attributes?.setting || []
    const updatedSettings = settings.map((item) => {
      if (item.tenantRole !== role) return item

      return {
        ...item,
        groups: settingGroups,
        setting_groups: settingGroups,
        setting_groups_mode: 'customized',
      }
    })

    return await this.commandService.publishPartialUpdateAsync(
      {
        pk: tenant.pk,
        sk: tenant.sk,
        version: tenant.version,
        attributes: {
          ...tenant.attributes,
          setting: updatedSettings,
        },
      },
      context,
    )
  }

  private sortGroups(groups: string[]) {
    return groups.sort((a, b) => {
      const countA = a.split('#').length - 1
      const countB = b.split('#').length - 1

      return countB !== countA ? countB - countA : a.localeCompare(b)
    })
  }
}
