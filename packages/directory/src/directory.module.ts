import {
  buildDomainCommandModule,
  buildPrismaProviderAsync,
  buildPrismaProviderSync,
  DataStoreModule,
  QueueModule,
} from '@mbc-cqrs-serverless/core'
import { DynamicModule, Module } from '@nestjs/common'

import { DirectoryController } from './directory.controller'
import {
  ConfigurableModuleClass,
  DEFAULT_DIRECTORY_TABLE_NAME,
  DirectoryStorageModuleAsyncOptions,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  PRISMA_SERVICE,
} from './directory.module-definition'
import { DirectoryService } from './directory.service'
import { DirectoryFileService } from './directory-file.service'
import { DynamoService } from './dynamodb.service'

@Module({
  imports: [DataStoreModule, QueueModule],
  providers: [DirectoryService, DirectoryFileService, DynamoService],
  exports: [DirectoryService, DirectoryFileService, DynamoService],
})
export class DirectoryStorageModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    const base = super.register(options)
    const providers = [...(base.providers ?? [])]
    const controllers = [...(base.controllers ?? [])]
    const imports = [...(base.imports ?? [])]

    // The domain services inject PRISMA_SERVICE unconditionally, so it must be
    // registered regardless of whether controllers are enabled.
    providers.push(
      buildPrismaProviderSync(options.prismaService, PRISMA_SERVICE),
    )

    // Data-sync handlers are registered here (not inside CommandModule) so they
    // can resolve PRISMA_SERVICE from this module's scope.
    const handlers = options.dataSyncHandlers ?? []
    providers.push(...handlers)

    if (options.enableController) {
      controllers.push(DirectoryController)
    }

    imports.push(
      buildDomainCommandModule(DEFAULT_DIRECTORY_TABLE_NAME, {
        tableName: options.tableName,
        dataSyncHandlers: handlers,
      }),
    )

    return { ...base, providers, controllers, imports }
  }

  static registerAsync(
    options: DirectoryStorageModuleAsyncOptions,
  ): DynamicModule {
    const base = super.registerAsync({
      imports: options.imports,
      inject: options.inject ?? [],
      // Merge the build-time structural fields into the options token so
      // DirectoryService can read tableName/pkPrefix/prismaModelName. The async
      // factory only needs to resolve `prismaService`.
      useFactory: async (...args: any[]) => {
        const resolved = (await options.useFactory?.(...args)) ?? {}
        return {
          ...resolved,
          enableController: options.enableController,
          dataSyncHandlers: options.dataSyncHandlers,
          tableName: options.tableName ?? DEFAULT_DIRECTORY_TABLE_NAME,
          pkPrefix: options.pkPrefix,
          prismaModelName: options.prismaModelName,
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
      controllers.push(DirectoryController)
    }

    // tableName is a build-time constant, so CommandModule.register() (which
    // eagerly creates the `<tableName>_CommandEventHandler` alias) is correct.
    imports.push(
      buildDomainCommandModule(DEFAULT_DIRECTORY_TABLE_NAME, {
        tableName: options.tableName,
        dataSyncHandlers: handlers,
      }),
    )

    return { ...base, providers, controllers, imports }
  }
}
