import { ConfigurableModuleBuilder } from '@nestjs/common'

import { CommandModuleOptions } from '../interfaces/command-module-options.interface'

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<CommandModuleOptions>().build()
