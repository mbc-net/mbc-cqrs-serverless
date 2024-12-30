import {
  CommandModel,
  DataModel,
  DetailKey,
  IInvoke,
} from '@mbc-cqrs-serverless/core'

import { CreateSettingDto } from '../dto/settings/create.setting.dto'
import { UpdateSettingDto } from '../dto/settings/update.setting.dto'
import { CreateCommonTenantSettingDto } from '../dto/settings/create-common.setting.dto'
import { CreateCroupSettingDto } from '../dto/settings/create-group-setting.dto'

export interface ISettingService {
  /**
   * Retrieve tenant code, user ID, and group settings from Cognito.
   * Fetch settings from DynamoDB in the order of levels: user => group => tenant => common.
   * Return the settings result for the user.
   * @param key - The key used to identify the setting e.g. UserListSetting
   * @returns A promise that resolves to the setting s data entity.
   */
  getSetting(
    key: string,
    options: { invokeContext: IInvoke },
  ): Promise<DataModel>

  /**
   * Creates a new setting code based on the provided data.
   *
   * @param dto - The data transfer object containing the parameters required for creating a setting.
   * dto contains:
   *   - name: string - The name of the setting.
   *   - code: string - The code of the setting.
   *   - tenantCode: string - The tenantCode of the setting, e.g., (COMMON, MBC, MAI).
   *   - type: string - The type, which can be common, tenant, group, or user.
   *   - entityIdentifier: string - The group identifier, e.g., (group:1, 1#2, 1#4, 1#2#3), (user:abc).
   *   - attributes: object - The setting data.
   *     Example SettingEntity:
   *     - User level:
   *       - pk: SETTING#mbc#USER#abc
   *       - sk: UserListSetting
   *       - id: SETTING#mbc#USER#abc#UserListSetting
   *       - attributes: object
   *       - name: UserListSetting
   *       - type: USER
   *     - Group level:
   *       - pk: SETTING#MBC#group2#4
   *       - sk: UserListSetting
   *       - id: SETTING#mbc#group#2#4#UserListSetting
   *       - attributes: object
   *       - name: UserListSetting
   *       - type: GROUP
   *     - Tenant :
   *       - pk: SETTING#MBC
   *       - sk: UserListSetting
   *       - id: SETTING#mbc#UserListSetting
   *       - attributes: object
   *       - name: UserListSetting
   *       - type: Tenant
   *     - COMMON:
   *       - pk: SETTING#COMMON
   *       - sk: UserListSetting
   *       - id: SETTING#COMMON#UserListSetting
   *       - attributes: object
   *       - name: string
   *       - type: string
   * @param options - Additional options including the invocation context.
   * @returns A promise that resolves to the newly created setting's data entity.
   */
  // createSetting(
  //   dto: CreateSettingByTenantDto,
  //   options: {
  //     invokeContext: IInvoke
  //   },
  // ): Promise<CommandModel>

  /**
   * Updates an existing tenant code with new data.
   *
   * @param options - Options including the invocation context.
   * @returns A promise that resolves to the updated tenant code's data entity.
   */
  updateSetting(
    dto: UpdateSettingDto,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel>

  /**
   * Deletes an existing tenant code identified by the specified key.
   *
   * @param key - The key used to identify the tenant code to delete.
   * @param options - Additional options including the invocation context.
   * @returns A promise that resolves to the data entity of the deleted tenant code.
   */
  deleteSetting(
    key: DetailKey,
    options: { invokeContext: IInvoke },
  ): Promise<CommandModel>


  createCommonTenantSetting(
    dto: CreateCommonTenantSettingDto,
    options: {
      invokeContext: IInvoke
    },
  ): Promise<CommandModel>



  createTenantSetting(
    dto: CreateSettingDto,
    options: {
      invokeContext: IInvoke
    },
  ): Promise<CommandModel>


  createGroupSetting(dto: CreateCroupSettingDto,
    options: {
      invokeContext: IInvoke
    }
  ): Promise<CommandModel>

  createUserSetting(
    dto: CreateSettingDto,
    options: {
      invokeContext: IInvoke
    },
  ): Promise<CommandModel>
}
