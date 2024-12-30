import {
  CommandDto,
  CommandModel,
  CommandService,
  DataEntity,
  DataModel,
  DataService,
  DetailKey,
  generateId,
  getUserContext,
  IInvoke,
  KEY_SEPARATOR,
  VERSION_FIRST,
} from '@mbc-cqrs-serverless/core'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'

import { CreateSettingDto } from './dto/settings/create.setting.dto'
import { SettingTypeEnum } from './enums/setting.enum'
import { ISettingService } from './interfaces/setting.service.interface'
import { CreateCommonTenantSettingDto } from './dto/settings/create-common.setting.dto'
import { SETTING_TENANT_PREFIX, TENANT_SYSTEM_PREFIX } from './constants/tenant.constant'
import { CreateCroupSettingDto } from './dto/settings/create-group-setting.dto'
@Injectable()
export class SettingService implements ISettingService {
  private readonly logger = new Logger(SettingService.name)

  constructor(
    private readonly commandService: CommandService,
    private readonly dataService: DataService,
  ) { }


  async getSetting(
    key: string,
    options: { invokeContext: IInvoke },
  ): Promise<DataModel> {
    const { tenantCode, tenantRole, userId } = getUserContext(options.invokeContext);
    const basePk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`;

    // Try fetching user-level setting first
    let setting = await this.dataService.getItem({
      pk: `${basePk}${KEY_SEPARATOR}${SettingTypeEnum.TENANT_USER}${KEY_SEPARATOR}${userId}`,
      sk: key
    });

    if (setting) return setting;

    // Fetch tenant-level settings
    const tenant = await this.dataService.getItem({
      pk: `${TENANT_SYSTEM_PREFIX}${KEY_SEPARATOR}${tenantCode}`,
      sk: SETTING_TENANT_PREFIX
    });

    if (tenant?.attributes) {
      const groupSettingByRole = tenant.attributes.find(i => i.tenantRole === tenantRole);

      if (groupSettingByRole) {
        // TODO: Handle group-specific settings retrieval here
        return null; // Placeholder for actual group settings retrieval logic
      }
    }

    // Fallback to common tenant-level settings
    return (
      await this.dataService.getItem({
        pk: `${basePk}`,
        sk: key
      }) ||
      await this.dataService.getItem({
        pk: `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${SettingTypeEnum.TENANT_COMMON}`,
        sk: key
      })
    );
  }


  async createCommonTenantSetting(dto: CreateCommonTenantSettingDto, options: { invokeContext: IInvoke }): Promise<CommandModel> {
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
  async createTenantSetting(dto: CreateSettingDto, options: { invokeContext: IInvoke }): Promise<CommandModel> {
    const { name, tenantCode, attributes, code } = dto

    const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode || SettingTypeEnum.TENANT_COMMON}`
    const sk = code

    const commad: CommandDto = {
      sk,
      pk,
      code: sk,
      name: name,
      id: generateId(pk, sk),
      tenantCode: tenantCode || SettingTypeEnum.TENANT_COMMON,
      type: SettingTypeEnum.TENANT_SYSTEM,
      version: VERSION_FIRST,

      attributes,
    }
    return await this.commandService.publishAsync(commad, options)
  }

  async createGroupSetting(dto: CreateCroupSettingDto, options: { invokeContext: IInvoke }): Promise<CommandModel> {
    const { name, tenantCode, attributes, code, groupName } = dto

    const basePk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`
    let pk = basePk


    pk += `${KEY_SEPARATOR}${SettingTypeEnum.TENANT_GROUP}${KEY_SEPARATOR}${groupName}`


    const sk = code

    const commad: CommandDto = {
      sk,
      pk,
      code: sk,
      name: name,
      id: generateId(pk, sk),
      tenantCode: tenantCode || SettingTypeEnum.TENANT_COMMON,
      type: SettingTypeEnum.TENANT_GROUP,
      version: VERSION_FIRST,

      attributes,
    }
    return await this.commandService.publishAsync(commad, options)
  }
  async createUserSetting(dto: CreateSettingDto, options: { invokeContext: IInvoke }): Promise<CommandModel> {
    const { name, tenantCode, attributes, code } = dto

    const basePk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`
    let pk = basePk
    const userContext = getUserContext(options.invokeContext)
    const userId = userContext.userId

    pk += `${KEY_SEPARATOR}${SettingTypeEnum.TENANT_USER}${KEY_SEPARATOR}${userId}`

    const sk = code

    const commad: CommandDto = {
      sk,
      pk,
      code: sk,
      name: name,
      id: generateId(pk, sk),
      tenantCode: tenantCode || SettingTypeEnum.TENANT_COMMON,
      type: SettingTypeEnum.TENANT_GROUP,
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
