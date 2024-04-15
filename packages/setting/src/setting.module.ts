import { CommandModule } from '@mbc-cqrs-severless/core'
import { DynamicModule, Module } from '@nestjs/common'

import { DataSettingController } from './data-setting.controller'
import { DataSettingService } from './data-setting.service'
import { SettingController } from './setting.controller'
import {
  ConfigurableModuleClass,
  OPTIONS_TYPE,
} from './setting.module-definition'
import { SettingService } from './setting.service'
@Module({
  imports: [
    CommandModule.register({
      tableName: 'master',
    }),
  ],
  providers: [SettingService, DataSettingService],
})
export class SettingModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    const module = super.register(options)

    if (options.enableController) {
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
