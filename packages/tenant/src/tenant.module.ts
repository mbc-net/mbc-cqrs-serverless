import {
  CommandModule,
  DataStoreModule,
  QueueModule,
} from '@mbc-cqrs-serverless/core'
import { DynamicModule, Module } from '@nestjs/common'

import { TABLE_NAME } from './constants'
import { TenantController } from './controllers'
import { TenantService } from './services'
import {
  ConfigurableModuleClass,
  OPTIONS_TYPE,
} from './tenant.module-definition'

@Module({
  imports: [DataStoreModule, QueueModule],
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
    const imports = [...(module.imports ?? [])]

    imports.push(
      CommandModule.register({
        tableName: TABLE_NAME,
        dataSyncHandlers: options?.dataSyncHandlers,
      }),
    )

    return {
      ...module,
      imports,
    }
  }
}
