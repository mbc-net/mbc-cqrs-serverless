import { ConfigurableModuleBuilder } from '@nestjs/common'

export interface SequencesModuleOptions {
  enableController?: boolean
}

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<SequencesModuleOptions>().build()
