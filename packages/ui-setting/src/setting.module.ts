import {
  buildDomainCommandModule,
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
  DEFAULT_UI_SETTING_TABLE_NAME,
  OPTIONS_TYPE,
  SettingModuleAsyncOptions,
} from './setting.module-definition'

@Module({
  imports: [DataStoreModule, QueueModule],
  providers: [SettingService, DataSettingService],
  exports: [SettingService, DataSettingService],
})
export class SettingModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    const base = super.register(options)
    const controllers = [...(base.controllers ?? [])]
    const imports = [...(base.imports ?? [])]

    const providers = [...(base.providers ?? [])]
    const handlers = options.dataSyncHandlers ?? []
    providers.push(...handlers)

    if (options.enableDataController) {
      controllers.push(DataSettingController)
    }
    if (options.enableSettingController) {
      controllers.push(SettingController)
    }

    imports.push(
      buildDomainCommandModule(DEFAULT_UI_SETTING_TABLE_NAME, {
        tableName: options.tableName,
        dataSyncHandlers: handlers,
        registerEventHandlerAlias: options.registerEventHandlerAlias,
      }),
    )

    return { ...base, providers, controllers, imports }
  }

  static registerAsync(options: SettingModuleAsyncOptions): DynamicModule {
    const base = super.registerAsync({
      imports: options.imports,
      inject: options.inject ?? [],
      useFactory: async (...args: any[]) => {
        await options.useFactory?.(...args)
        return {
          enableDataController: options.enableDataController,
          enableSettingController: options.enableSettingController,
          tableName: options.tableName ?? DEFAULT_UI_SETTING_TABLE_NAME,
          dataSyncHandlers: options.dataSyncHandlers,
        }
      },
    })
    const controllers = [...(base.controllers ?? [])]
    const imports = [...(base.imports ?? [])]
    const providers = [...(base.providers ?? [])]
    const handlers = options.dataSyncHandlers ?? []
    providers.push(...handlers)

    if (options.enableDataController) {
      controllers.push(DataSettingController)
    }
    if (options.enableSettingController) {
      controllers.push(SettingController)
    }

    imports.push(
      buildDomainCommandModule(DEFAULT_UI_SETTING_TABLE_NAME, {
        tableName: options.tableName,
        dataSyncHandlers: handlers,
        registerEventHandlerAlias: options.registerEventHandlerAlias,
      }),
    )

    return { ...base, providers, controllers, imports }
  }
}
