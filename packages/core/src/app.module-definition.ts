import { ConfigurableModuleBuilder } from '@nestjs/common'

import { AppModuleOptions } from './interfaces'

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<AppModuleOptions>()
    .setClassMethodName('forRoot')
    .build()
