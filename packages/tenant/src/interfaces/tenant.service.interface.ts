import {
  CommandModel,
  DataModel,
  DetailKey,
  IInvoke,
} from '@mbc-cqrs-serverless/core'

import { AddGroupTenantDto } from '../dto/tenant/add-group-tenant.dto'
import { CreateTenantDto } from '../dto/tenant/create.tenant.dto'
import { CreateCommonTenantDto } from '../dto/tenant/create-common-tenant.dto'
import { UpdateTenantDto } from '../dto/tenant/update.tenant.dto'

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
   *  dto contains:
   *   - name: string - The name of the setting.
   *   - code: string - The code of the setting.
   *   - description: string .
   *   - attributes: object - The setting data.
   *     Example TenantCodeEntity:
   *      + COMMON
   *       - pk: TENANT#COMMON
   *       - sk: ''
   *       - id: TENANT#COMMON
   *       - attributes: object
   *       - name: COMMON
   *       - type: string
   
   *      + Tenant MBC
   *       - pk: TENANT#COMMON
   *       - sk: mbc
   *       - id: TENANT#COMMON#mbc
   *       - attributes: object
   *       - name: MBC
   *       - type: string
   * @param options - Additional options including the invocation context.
   * @returns A promise that resolves to the newly created tenant code's data entity.
   */
  createTenant(
    dto: CreateTenantDto,
    context: {
      invokeContext: IInvoke
    },
  ): Promise<Record<string, any>>

  /**
   * Updates an existing tenant code with new data.
   *
   * @param options - Options including the invocation context.
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
   * @param options - Additional options including the invocation context.
   * @returns A promise that resolves to the data entity of the deleted tenant code.
   */
  deleteTenant(
    key: DetailKey,
    context: { invokeContext: IInvoke },
  ): Promise<CommandModel>

  addGroup(
    dto: AddGroupTenantDto,
    context: { invokeContext: IInvoke },
  ): Promise<CommandModel>

  createCommonTenant(
    dto: CreateCommonTenantDto,
    context: {
      invokeContext: IInvoke
    },
  ): Promise<CommandModel>
}
