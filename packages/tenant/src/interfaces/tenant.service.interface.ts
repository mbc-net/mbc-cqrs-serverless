import {
  CommandModel,
  DataModel,
  DetailKey,
  IInvoke,
} from '@mbc-cqrs-serverless/core'

import { AddTenantGroupDto } from '../dto/tenant/add-group-tenant.dto'
import { CreateTenantDto } from '../dto/tenant/create.tenant.dto'
import { CreateCommonTenantDto } from '../dto/tenant/create-common-tenant.dto'
import { UpdateTenantDto } from '../dto/tenant/update.tenant.dto'
import { UpdateTenantGroupDto } from '../dto/tenant/update-tenant-group.dto'

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
    dto: CreateTenantDto,
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
    dto: UpdateTenantDto,
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
    dto: CreateCommonTenantDto,
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
    dto: AddTenantGroupDto,
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
    key: DetailKey,
    dto: UpdateTenantGroupDto,
    context: { invokeContext: IInvoke },
  ): Promise<CommandModel>
}
