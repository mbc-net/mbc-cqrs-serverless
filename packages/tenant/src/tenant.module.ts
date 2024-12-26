import { CommandModule } from '@mbc-cqrs-serverless/core'
import { DynamicModule, Module } from '@nestjs/common'

import { SettingService } from './setting.service'
import { TenantController } from './tenant.controller'
import {
  ConfigurableModuleClass,
  OPTIONS_TYPE,
} from './tenant.module-definition'
import { TenantService } from './tenant.service'

@Module({
  imports: [
    CommandModule.register({
      tableName: 'tenant',
    }),
  ],
  providers: [TenantService, SettingService],
  exports: [TenantService, SettingService],
})
export class TenantModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    const module = super.register(options)

    if (options.enableController) {
      if (!module.controllers) {
        module.controllers = []
      }
      module.controllers.push(TenantController)
    }

    return {
      ...module,
    }
  }
}
