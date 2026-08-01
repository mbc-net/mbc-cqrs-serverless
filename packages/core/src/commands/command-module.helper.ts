import { DynamicModule, Provider, Type } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'

import { IDataSyncHandler } from '../interfaces/data-sync-handler.interface'
import { CommandModule } from './command.module'

/**
 * Structural (build-time) options that every domain module forwards to
 * {@link CommandModule}. The table name is a deploy-time constant, so it must be
 * known synchronously at module-composition time — the `<tableName>_CommandEventHandler`
 * provider alias is created eagerly by `CommandModule.register`.
 */
export interface DomainCommandModuleOptions {
  /** Raw DynamoDB base table name (physical name = `${NODE_ENV}-${APP_NAME}-${tableName}`). */
  tableName?: string
  dataSyncHandlers?: Type<IDataSyncHandler>[]
}

/**
 * Compose {@link CommandModule} for a domain module, applying the domain's
 * default table name when the caller omitted one.
 *
 * Used by BOTH `register()` and `registerAsync()` so the static
 * `<tableName>_CommandEventHandler` alias is always generated from a
 * build-time-known table name (dynamic provider tokens cannot be produced from
 * an async factory result).
 */
export function buildDomainCommandModule(
  defaultTableName: string,
  options: DomainCommandModuleOptions,
): DynamicModule {
  return CommandModule.register({
    tableName: options.tableName ?? defaultTableName,
    dataSyncHandlers: options.dataSyncHandlers,
  })
}

/**
 * Build the `PRISMA_SERVICE` provider for the synchronous `register()` path.
 * Fails fast when `prismaService` is missing, because the domain services
 * inject the token unconditionally.
 */
export function buildPrismaProviderSync(
  prismaService: Type<any> | undefined,
  token: string | symbol,
): Provider {
  if (!prismaService) {
    throw new Error(
      `${String(token)}: 'prismaService' is required for this module.`,
    )
  }
  return { provide: token, useExisting: prismaService }
}

/**
 * Build the `PRISMA_SERVICE` provider for the `registerAsync()` path. The
 * concrete PrismaService class is resolved at runtime from the module options
 * token (populated by the caller's async factory) via {@link ModuleRef}.
 */
export function buildPrismaProviderAsync(
  optionsToken: string | symbol,
  prismaToken: string | symbol,
): Provider {
  return {
    provide: prismaToken,
    inject: [ModuleRef, optionsToken],
    useFactory: (
      moduleRef: ModuleRef,
      options: { prismaService?: Type<any> },
    ) => {
      if (!options?.prismaService) {
        throw new Error(
          `${String(prismaToken)}: 'prismaService' is required (registerAsync factory must return it).`,
        )
      }
      return moduleRef.get(options.prismaService, { strict: false })
    },
  }
}
