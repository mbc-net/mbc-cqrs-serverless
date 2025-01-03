import { CommandModel, DetailKey, IInvoke } from '@mbc-cqrs-serverless/core'

import { CreateSettingDto } from '../dto/settings/create.setting.dto'
import { CreateCommonTenantSettingDto } from '../dto/settings/create-common.setting.dto'
import { CreateCroupSettingDto } from '../dto/settings/create-group-setting.dto'
import { CreateUserSettingDto } from '../dto/settings/create-user.setting.dto'
import { GetSettingDto } from '../dto/settings/get-setting.dto'
import { UpdateSettingDto } from '../dto/settings/update.setting.dto'
import { SettingEntity } from '../entities/setting.entity'

export interface ISettingService {
  /**
   * Retrieve tenant code, user ID, and group settings from Cognito.
   * Fetch settings from DynamoDB in the order of levels: user => group => tenant => common.
   * Return the settings result for the user.
   * @param key - The key used to identify the setting e.g. UserListSetting
   * @returns A promise that resolves to the setting s data entity.
   *     Example SettingEntity
   *     {
   *       id: SETTING#mbc#USER#abc#UserListSetting
   *       settingValue: object
   *     }
   */
  getSetting(
    key: GetSettingDto,
    context: { invokeContext: IInvoke },
  ): Promise<SettingEntity>
  /**
   * Updates an existing tenant code with new data.
   *
   * @param context - The invocation context.
   * @returns A promise that resolves to the updated tenant code's data entity.
   */
  updateSetting(
    params: DetailKey,
    dto: UpdateSettingDto,
    context: { invokeContext: IInvoke },
  ): Promise<CommandModel>

  /**
   * Deletes an existing tenant code identified by the specified key.
   *
   * @param key - The key used to identify the tenant code to delete.
   * @param context - The invocation context.
   * @returns A promise that resolves to the data entity of the deleted tenant code.
   */
  deleteSetting(
    key: DetailKey,
    context: { invokeContext: IInvoke },
  ): Promise<CommandModel>

  createCommonTenantSetting(
    dto: CreateCommonTenantSettingDto,
    context: {
      invokeContext: IInvoke
    },
  ): Promise<CommandModel>

  createTenantSetting(
    dto: CreateSettingDto,
    context: {
      invokeContext: IInvoke
    },
  ): Promise<CommandModel>

  createGroupSetting(
    dto: CreateCroupSettingDto,
    context: {
      invokeContext: IInvoke
    },
  ): Promise<CommandModel>

  createUserSetting(
    dto: CreateUserSettingDto,
    context: {
      invokeContext: IInvoke
    },
  ): Promise<CommandModel>
}
