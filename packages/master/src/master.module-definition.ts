import { ConfigurableModuleBuilder } from '@nestjs/common'

export interface MasterModuleOptions {
  enableController?: boolean
}

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<MasterModuleOptions>().build()
