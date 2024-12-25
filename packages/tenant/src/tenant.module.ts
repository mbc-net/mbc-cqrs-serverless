import { DataStoreModule } from '@mbc-cqrs-serverless/core/dist'
import { DynamicModule, Module } from '@nestjs/common'

import { TenantController } from './tenant.controller'
import {
  ConfigurableModuleClass,
  OPTIONS_TYPE,
} from './tenant.module-definition'
import { TenantService } from './tenant.service'

@Module({
  imports: [DataStoreModule],
  providers: [TenantService],
  exports: [TenantService],
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
