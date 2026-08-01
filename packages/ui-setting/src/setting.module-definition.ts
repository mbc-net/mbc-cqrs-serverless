import { IDataSyncHandler } from '@mbc-cqrs-serverless/core'
import { ConfigurableModuleBuilder, ModuleMetadata, Type } from '@nestjs/common'

/**
 * ui-setting stores its data on the master table by default, so `tableName`
 * defaults to 'master'. When combined with MasterModule, both modules MUST use
 * the same `tableName` value.
 */
export const DEFAULT_UI_SETTING_TABLE_NAME = 'master'

export interface SettingModuleOptions {
  enableSettingController?: boolean
  enableDataController?: boolean
  /** DynamoDB base table name. Default: 'master' (shared with MasterModule). */
  tableName?: string
  dataSyncHandlers?: Type<IDataSyncHandler>[]
  /**
   * Whether SettingModule owns the `<tableName>_CommandEventHandler` alias.
   * Defaults to `true`. When combined with MasterModule on the same (default
   * 'master') table, set this to `false` so MasterModule owns the alias and the
   * duplicate-alias guard does not trip.
   */
  registerEventHandlerAlias?: boolean
}

export interface SettingModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  enableSettingController?: boolean
  enableDataController?: boolean
  tableName?: string
  dataSyncHandlers?: Type<IDataSyncHandler>[]
  registerEventHandlerAlias?: boolean
  inject?: any[]
  /** ui-setting needs no runtime-resolved options; provided for API symmetry. */
  useFactory?: (...args: any[]) => Promise<unknown> | unknown
}

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<SettingModuleOptions>().build()
