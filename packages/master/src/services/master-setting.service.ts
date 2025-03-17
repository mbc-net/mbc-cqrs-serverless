import {
  CommandDto,
  CommandModel,
  CommandService,
  DataService,
  DetailKey,
  DynamoDbService,
  generateId,
  getUserContext,
  IInvoke,
  KEY_SEPARATOR,
  TableType,
  VERSION_FIRST,
} from '@mbc-cqrs-serverless/core'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'

import {
  SETTING_SK_PREFIX,
  SETTING_TENANT_PREFIX,
  TENANT_SYSTEM_PREFIX,
} from '../constants'
import {
  CommonSettingDto,
  GetSettingDto,
  GroupSettingDto,
  TenantSettingDto,
  UpdateSettingDto,
  UserSettingDto,
} from '../dto'
import { MasterSettingEntity } from '../entities'
import { SettingTypeEnum } from '../enums'
import { generateMasterPk, generateMasterSettingSk } from '../helpers'
import { IMasterSettingService } from '../interfaces'

@Injectable()
export class MasterSettingService implements IMasterSettingService {
  private readonly logger = new Logger(MasterSettingService.name)
  private tenantTableName: string

  constructor(
    private readonly commandService: CommandService,
    private readonly dataService: DataService,
    private readonly dynamoDbService: DynamoDbService,
  ) {
    this.tenantTableName = dynamoDbService.getTableName(
      'tenant',
      TableType.DATA,
    )
    this.logger.debug('tableName: ' + this.tenantTableName)
  }

  private async fetchSetting(
    pk: string,
    skPrefix: string,
    code: string,
  ): Promise<any> {
    const sk = `${skPrefix}${code}`
    return this.dataService.getItem({ pk, sk })
  }

  private async fetchGroupSetting(
    groups: string[],
    tenantCode: string,
    code: string,
  ): Promise<any> {
    const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`
    for (const group of groups) {
      const skPrefix = `${SETTING_SK_PREFIX}${KEY_SEPARATOR}${SettingTypeEnum.TENANT_GROUP}${KEY_SEPARATOR}${group}${KEY_SEPARATOR}`
      const result = await this.fetchSetting(pk, skPrefix, code)
      if (result) return result
    }
    return null
  }

  async getSetting(
    dto: GetSettingDto,
    options: { invokeContext: IInvoke },
  ): Promise<MasterSettingEntity> {
    const { tenantCode, tenantRole, userId } = getUserContext(
      options.invokeContext,
    )
    const { code } = dto
    const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`

    // Fetch user-level setting
    let setting = await this.fetchSetting(
      pk,
      `${SETTING_SK_PREFIX}${KEY_SEPARATOR}${SettingTypeEnum.TENANT_USER}${KEY_SEPARATOR}${userId}${KEY_SEPARATOR}`,
      code,
    )

    if (setting) {
      return new MasterSettingEntity({
        id: setting.id,
        settingValue: setting.attributes,
      })
    }

    // Fetch tenant-level group settings

    try {
      const tenant = await this.dynamoDbService.getItem(this.tenantTableName, {
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
            code,
          )
          if (setting) {
            return new MasterSettingEntity({
              id: setting.id,
              settingValue: setting.attributes,
            })
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error fetching group setting: ${error}`)
    }

    // Fallback to common tenant-level settings
    setting = await this.fetchSetting(
      pk,
      `${SETTING_SK_PREFIX}${KEY_SEPARATOR}`,
      code,
    )
    if (setting) {
      return new MasterSettingEntity({
        id: setting.id,
        settingValue: setting.attributes,
      })
    }

    setting = await this.fetchSetting(
      `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${SettingTypeEnum.TENANT_COMMON}`,
      `${SETTING_SK_PREFIX}${KEY_SEPARATOR}`,
      code,
    )
    if (!setting) {
      this.logger.error(`Setting not found ${code}`)
      throw new BadRequestException(`Setting not found with code: ${code}`)
    }

    return new MasterSettingEntity({
      id: setting.id,
      settingValue: setting.attributes,
    })
  }

  async createCommonTenantSetting(
    dto: CommonSettingDto,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { name, settingValue, code } = dto

    const pk = generateMasterPk(SettingTypeEnum.TENANT_COMMON)
    const sk = generateMasterSettingSk(code)
    const setting = await this.dataService.getItem({ pk, sk })
    if (setting && setting.isDeleted === false) {
      throw new BadRequestException(`Setting already exists: ${code}`)
    }
    const command: CommandDto = {
      sk,
      pk,
      code: code,
      name: name,
      id: generateId(pk, sk),
      tenantCode: SettingTypeEnum.TENANT_COMMON,
      type: SettingTypeEnum.TENANT_COMMON,
      version: setting?.version ?? VERSION_FIRST,
      isDeleted: false,
      attributes: settingValue,
    }
    return await this.commandService.publishAsync(command, options)
  }
  async createTenantSetting(
    dto: TenantSettingDto,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { name, tenantCode, settingValue, code } = dto

    const pk = generateMasterPk(tenantCode)
    const sk = generateMasterSettingSk(code)

    const setting = await this.dataService.getItem({ pk, sk })
    if (setting && setting.isDeleted === false) {
      throw new BadRequestException(`Setting already exists: ${code}`)
    }

    const command: CommandDto = {
      sk,
      pk,
      code: code,
      name: name,
      id: generateId(pk, sk),
      tenantCode: tenantCode,
      type: SettingTypeEnum.TENANT,
      version: setting?.version ?? VERSION_FIRST,
      isDeleted: false,
      attributes: settingValue,
    }
    return await this.commandService.publishAsync(command, options)
  }

  async createGroupSetting(
    dto: GroupSettingDto,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { name, tenantCode, settingValue, code, groupId } = dto

    const pk = generateMasterPk(tenantCode)

    const sk = `${SETTING_SK_PREFIX}${KEY_SEPARATOR}${SettingTypeEnum.TENANT_GROUP}${KEY_SEPARATOR}${groupId}${KEY_SEPARATOR}${code}`

    const setting = await this.dataService.getItem({ pk, sk })
    if (setting && setting.isDeleted === false) {
      throw new BadRequestException(`Setting already exists: ${code}`)
    }

    const command: CommandDto = {
      sk,
      pk,
      code: code,
      name: name,
      id: generateId(pk, sk),
      tenantCode: tenantCode,
      type: SettingTypeEnum.TENANT_GROUP,
      version: setting?.version ?? VERSION_FIRST,
      isDeleted: false,
      attributes: settingValue,
    }
    return await this.commandService.publishAsync(command, options)
  }
  async createUserSetting(
    dto: UserSettingDto,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel> {
    const { name, tenantCode, settingValue, code, userId } = dto

    const pk = generateMasterPk(tenantCode)

    const sk = `${SETTING_SK_PREFIX}${KEY_SEPARATOR}${SettingTypeEnum.TENANT_USER}${KEY_SEPARATOR}${userId}${KEY_SEPARATOR}${code}`

    const setting = await this.dataService.getItem({ pk, sk })
    if (setting && setting.isDeleted === false) {
      throw new BadRequestException(`Setting already exists: ${code}`)
    }

    const command: CommandDto = {
      sk,
      pk,
      code: code,
      name: name,
      id: generateId(pk, sk),
      tenantCode: tenantCode,
      type: SettingTypeEnum.TENANT_USER,
      version: setting?.version ?? VERSION_FIRST,
      isDeleted: false,
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
      throw new BadRequestException("Setting doesn't exist")
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
      throw new BadRequestException("Setting doesn't exist")
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
