import {
  buildDomainCommandModule,
  buildPrismaProviderAsync,
  buildPrismaProviderSync,
  DataStoreModule,
  QueueModule,
} from '@mbc-cqrs-serverless/core'
import { SequencesModule } from '@mbc-cqrs-serverless/sequence'
import { DynamicModule, Logger, Module } from '@nestjs/common'

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
  private static readonly logger = new Logger(MasterModule.name)

  /**
   * The `master` table is a framework-wide central config store: `TtlService`
   * (TTL config) and the sequence package (numbering formats) read the fixed
   * `master-data` table. Renaming it silently breaks those readers, so warn.
   */
  private static warnIfCustomTable(tableName?: string): void {
    if (tableName && tableName !== TABLE_NAME) {
      MasterModule.logger.warn(
        `tableName '${tableName}' overrides the 'master' table, which is also read ` +
          `at a fixed 'master-data' name by TtlService (TTL config) and the sequence ` +
          `package (numbering formats). Renaming the master table is not fully ` +
          `supported — TTL and sequence formats will silently fall back. Keep the ` +
          `default 'master' unless you have addressed those readers.`,
      )
    }
  }

  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    MasterModule.warnIfCustomTable(options.tableName)
    const base = super.register(options)
    const providers = [...(base.providers ?? [])]
    const controllers = [...(base.controllers ?? [])]
    const imports = [...(base.imports ?? [])]

    // The master services inject PRISMA_SERVICE unconditionally.
    providers.push(
      buildPrismaProviderSync(options.prismaService, PRISMA_SERVICE),
    )

    // Data-sync handlers are registered here (not inside CommandModule) so they
    // can resolve PRISMA_SERVICE from this module's scope.
    const handlers = options.dataSyncHandlers ?? []
    providers.push(...handlers)

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
        dataSyncHandlers: handlers,
      }),
    )

    return { ...base, providers, controllers, imports }
  }

  static registerAsync(options: MasterModuleAsyncOptions): DynamicModule {
    MasterModule.warnIfCustomTable(options.tableName)
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

    const handlers = options.dataSyncHandlers ?? []
    providers.push(...handlers)

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
        dataSyncHandlers: handlers,
      }),
    )

    return { ...base, providers, controllers, imports }
  }
}
