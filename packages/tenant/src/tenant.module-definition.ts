import { ConfigurableModuleBuilder } from '@nestjs/common'

export interface TenantModuleOptions {
  enableController?: boolean
}

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<TenantModuleOptions>().build()
