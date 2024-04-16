import {
  CommandModule,
  DataStoreModule,
  QueueModule,
} from '@mbc-cqrs-severless/core'
import { DynamicModule, Module } from '@nestjs/common'

import { DataSettingController } from './controllers/data-setting.controller'
import { SettingController } from './controllers/setting.controller'
import { DataSettingService } from './services/data-setting.service'
import { SettingService } from './services/setting.service'
import {
  ConfigurableModuleClass,
  OPTIONS_TYPE,
} from './setting.module-definition'

@Module({
  providers: [SettingService, DataSettingService],
  exports: [SettingService, DataSettingService],
})
export class SettingModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    const module = super.register(options)

    const { enableController, ...commandOpts } = options

    if (!module.imports) {
      module.imports = []
    }

    module.imports.push(
      CommandModule.register(commandOpts),
      DataStoreModule,
      QueueModule,
    )

    if (enableController) {
      if (!module.controllers) {
        module.controllers = []
      }
      module.controllers.push(SettingController, DataSettingController)
    }

    return {
      ...module,
    }
  }
}
