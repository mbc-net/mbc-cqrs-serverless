import {
  CommandModel,
  DetailKey,
  IInvoke,
  SearchDto,
} from '@mbc-cqrs-serverless/core'

import {
  CommonSettingDto,
  GetSettingDto,
  GroupSettingDto,
  TenantSettingDto,
  UpdateSettingDto,
  UserSettingDto,
} from '../dto'
import { MasterSettingEntity } from '../entities'

export interface IMasterSettingService {
  /**
   * Retrieve tenant code, user ID, and group settings from Cognito.
   * Fetch settings from DynamoDB in the order of levels: user => group => tenant => common.
   * Return the settings result for the user.
   * @param key - The key used to identify the setting e.g. UserListSetting
   * @returns A promise that resolves to the setting s data entity.
   *     Example MasterSettingEntity
   *     {
   *       id: SETTING#mbc#USER#abc#UserListSetting
   *       settingValue: object
   *     }
   */
  getSetting(
    key: GetSettingDto,
    context: { invokeContext: IInvoke },
  ): Promise<MasterSettingEntity>

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
    dto: CommonSettingDto,
    context: {
      invokeContext: IInvoke
    },
  ): Promise<CommandModel>

  createTenantSetting(
    dto: TenantSettingDto,
    context: {
      invokeContext: IInvoke
    },
  ): Promise<CommandModel>

  createGroupSetting(
    dto: GroupSettingDto,
    context: {
      invokeContext: IInvoke
    },
  ): Promise<CommandModel>

  createUserSetting(
    dto: UserSettingDto,
    context: {
      invokeContext: IInvoke
    },
  ): Promise<CommandModel>

  listSettingByRds(searchDto: SearchDto, context: { invokeContext: IInvoke })
}
