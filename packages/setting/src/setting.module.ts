import {
  CommandModule,
  DataStoreModule,
  QueueModule,
} from '@mbc-cqrs-serverless/core'
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
  imports: [
    CommandModule.register({
      tableName: 'master',
    }),
    DataStoreModule,
    QueueModule,
  ],
  providers: [SettingService, DataSettingService],
  exports: [SettingService, DataSettingService],
})
export class SettingModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    const module = super.register(options)

    const { enableDataController, enableSettingController } = options

    if (enableDataController || enableSettingController) {
      if (!module.controllers) {
        module.controllers = []
      }
      if (enableDataController) {
        module.controllers.push(DataSettingController)
      }
      if (enableSettingController) {
        module.controllers.push(SettingController)
      }
    }

    return {
      ...module,
    }
  }
}
