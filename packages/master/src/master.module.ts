import {
  buildDomainCommandModule,
  buildPrismaProviderAsync,
  buildPrismaProviderSync,
  DataStoreModule,
  QueueModule,
} from '@mbc-cqrs-serverless/core'
import { SequencesModule } from '@mbc-cqrs-serverless/sequence'
import { DynamicModule, Module } from '@nestjs/common'

import { TABLE_NAME } from './constants'
import {
  MasterBulkController,
  MasterDataController,
  MasterSettingController,
} from './controllers'
import { CustomTaskModule } from './custom-task/custom-task.module'
import { MasterSfnTaskEventHandler } from './handler/master-sfn-task.handler'
import {
  ConfigurableModuleClass,
  MasterModuleAsyncOptions,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  PRISMA_SERVICE,
} from './master.module-definition'
import { MasterDataService, MasterSettingService } from './services'

@Module({
  imports: [DataStoreModule, QueueModule],
  providers: [MasterDataService, MasterSettingService],
  exports: [MasterDataService, MasterSettingService],
})
export class MasterModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    const base = super.register(options)
    const providers = [...(base.providers ?? [])]
    const controllers = [...(base.controllers ?? [])]
    const imports = [...(base.imports ?? [])]

    // The master services inject PRISMA_SERVICE unconditionally.
    providers.push(
      buildPrismaProviderSync(options.prismaService, PRISMA_SERVICE),
    )

    if (options.enableController) {
      controllers.push(
        MasterBulkController,
        MasterDataController,
        MasterSettingController,
      )
      providers.push(MasterSfnTaskEventHandler)
      imports.push(CustomTaskModule, SequencesModule)
    }

    imports.push(buildDomainCommandModule(TABLE_NAME, options))

    return { ...base, providers, controllers, imports }
  }

  static registerAsync(options: MasterModuleAsyncOptions): DynamicModule {
    const base = super.registerAsync({
      imports: options.imports,
      inject: options.inject ?? [],
      useFactory: async (...args: any[]) => {
        const resolved = (await options.useFactory?.(...args)) ?? {}
        return {
          ...resolved,
          enableController: options.enableController,
          dataSyncHandlers: options.dataSyncHandlers,
          tableName: options.tableName ?? TABLE_NAME,
        }
      },
    })
    const providers = [...(base.providers ?? [])]
    const controllers = [...(base.controllers ?? [])]
    const imports = [...(base.imports ?? [])]

    providers.push(
      buildPrismaProviderAsync(MODULE_OPTIONS_TOKEN, PRISMA_SERVICE),
    )

    if (options.enableController) {
      controllers.push(
        MasterBulkController,
        MasterDataController,
        MasterSettingController,
      )
      providers.push(MasterSfnTaskEventHandler)
      imports.push(CustomTaskModule, SequencesModule)
    }

    imports.push(
      buildDomainCommandModule(TABLE_NAME, {
        tableName: options.tableName,
        dataSyncHandlers: options.dataSyncHandlers,
      }),
    )

    return { ...base, providers, controllers, imports }
  }
}
