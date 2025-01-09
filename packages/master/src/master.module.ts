import {
  CommandModule,
  DataStoreModule,
  QueueModule,
} from '@mbc-cqrs-serverless/core'
import { DynamicModule, Module } from '@nestjs/common'

import { TABLE_NAME } from './constants'
import { MasterDataController, MasterSettingController } from './controllers'
import {
  ConfigurableModuleClass,
  OPTIONS_TYPE,
} from './master.module-definition'
import { MasterDataService, MasterSettingService } from './services'

@Module({
  imports: [
    CommandModule.register({
      tableName: TABLE_NAME,
    }),
    DataStoreModule,
    QueueModule,
  ],
  providers: [MasterDataService, MasterSettingService],
  exports: [MasterDataService, MasterSettingService],
})
export class MasterModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    const module = super.register(options)

    if (options.enableController) {
      if (!module.controllers) {
        module.controllers = []
      }
      module.controllers.push(MasterDataController)
      module.controllers.push(MasterSettingController)
    }

    return {
      ...module,
    }
  }
}
