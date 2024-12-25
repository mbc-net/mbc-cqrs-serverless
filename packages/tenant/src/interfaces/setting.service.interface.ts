import { DataEntity, DetailKey, IInvoke } from '@mbc-cqrs-serverless/core'

import { CreateSettingByTenantDto } from '../dto/create.setting.dto'

/**
 * Interface representing the service responsible for managing tenant codes.
 */
export interface ISettingService {
  /**
   * Retrieves the current tenant code associated with a specific key.
   *
   * @param key - The key used to identify the tenant code details.
   * @returns A promise that resolves to the tenant code's data entity.
   */
  getSetting(key: DetailKey): Promise<DataEntity>

  /**
   * Creates a new tenant code based on the provided data.
   *
   * @param dto - The data transfer object containing the parameters required for creating a tenant code.
   * @param options - Additional options including the invocation context.
   * @returns A promise that resolves to the newly created tenant code's data entity.
   */
  createSetting(
    dto: CreateSettingByTenantDto,
    options: {
      invokeContext: IInvoke
    },
  ): Promise<DataEntity>

  /**
   * Updates an existing tenant code with new data.
   *
   * @param options - Options including the invocation context.
   * @returns A promise that resolves to the updated tenant code's data entity.
   */
  updateSetting(options: { invokeContext: IInvoke }): Promise<DataEntity>

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
  ): Promise<DataEntity>
}
