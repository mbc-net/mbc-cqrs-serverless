import { ConfigurableModuleBuilder } from '@nestjs/common'

export interface SettingModuleOptions {
  enableController?: boolean
}

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<SettingModuleOptions>().build()
