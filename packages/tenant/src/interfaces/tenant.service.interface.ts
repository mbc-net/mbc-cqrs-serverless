import {
  CommandModel,
  DataModel,
  DetailKey,
  IInvoke,
} from '@mbc-cqrs-serverless/core'

import {
  CommonTenantCreateDto,
  TenantCreateDto,
  TenantGroupAddDto,
  TenantGroupUpdateDto,
  TenantUpdateDto,
} from '../dto'

/**
 * Interface representing the service responsible for managing tenant codes.
 */
export interface ITenantService {
  /**
   * Retrieves the current tenant code associated with a specific key.
   *
   * @param key - The key used to identify the tenant code details.
   * @returns A promise that resolves to the tenant code's data entity.
   */
  getTenant(key: DetailKey): Promise<DataModel>

  /**
   * Creates a new tenant code based on the provided data.
   *
   * @param dto - The data transfer object containing the parameters required for creating a tenant code.
   * @param context - Additional options including the invocation context.
   * @returns A promise that resolves to the newly created tenant code's data entity.
   */
  createTenant(
    dto: TenantCreateDto,
    context: { invokeContext: IInvoke },
  ): Promise<CommandModel>

  /**
   * Updates an existing tenant code with new data.
   *
   * @param key - The key used to identify the tenant code to update.
   * @param dto - The data transfer object containing the updated parameters for the tenant code.
   * @param context - Additional options including the invocation context.
   * @returns A promise that resolves to the updated tenant code's data entity.
   */
  updateTenant(
    key: DetailKey,
    dto: TenantUpdateDto,
    context: { invokeContext: IInvoke },
  ): Promise<CommandModel>

  /**
   * Deletes an existing tenant code identified by the specified key.
   *
   * @param key - The key used to identify the tenant code to delete.
   * @param context - Additional options including the invocation context.
   * @returns A promise that resolves to the data entity of the deleted tenant code.
   */
  deleteTenant(
    key: DetailKey,
    context: { invokeContext: IInvoke },
  ): Promise<CommandModel>

  /**
   * Creates a new common tenant code based on the provided data.
   *
   * @param dto - The data transfer object containing the parameters required for creating a common tenant code.
   * @param context - Additional options including the invocation context.
   * @returns A promise that resolves to the newly created common tenant code's data entity.
   */
  createCommonTenant(
    dto: CommonTenantCreateDto,
    context: { invokeContext: IInvoke },
  ): Promise<CommandModel>

  /**
   * Adds a group to the tenant code.
   *
   * @param dto - The data transfer object containing the parameters required for adding a group to the tenant code.
   * @param context - Additional options including the invocation context.
   * @returns A promise that resolves to the data entity of the tenant code with the added group.
   */
  addTenantGroup(
    dto: TenantGroupAddDto,
    context: { invokeContext: IInvoke },
  ): Promise<CommandModel>

  /**
   * Customizes the setting groups for a tenant, switching to `customized` mode.
   *
   * @param key - The key used to identify the tenant.
   * @param settingGroups - The custom setting groups to assign.
   * @param context - Additional options including the invocation context.
   * @returns A promise that resolves to the updated tenant's data entity.
   */
  customizeSettingGroups(
    dto: TenantGroupUpdateDto,
    context: { invokeContext: IInvoke },
  ): Promise<CommandModel>
}
