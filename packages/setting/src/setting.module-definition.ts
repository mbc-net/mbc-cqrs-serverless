import { IDataSyncHandler } from '@mbc-cqrs-severless/core'
import { ConfigurableModuleBuilder, Type } from '@nestjs/common'
export interface SettingModuleOptions {
  enableController?: boolean
  tableName: string
  skipError?: boolean
  dataSyncHandlers?: Type<IDataSyncHandler>[]
  disableDefaultHandler?: boolean
}

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<SettingModuleOptions>().build()
