import { IDataSyncHandler } from '@mbc-cqrs-serverless/core'
import { ConfigurableModuleBuilder, ModuleMetadata, Type } from '@nestjs/common'

import { DatabaseProvider } from './helpers/database-provider'

export const PRISMA_SERVICE = 'PrismaServiceInjectToken'

export interface MasterModuleOptions {
  enableController?: boolean
  dataSyncHandlers?: Type<IDataSyncHandler>[]
  prismaService?: Type<any>
  /** DynamoDB base table name. Default: 'master'. */
  tableName?: string
  /** Tenant code that holds the shared (common) master data. Default: 'common'. */
  commonTenantCode?: string
  /**
   * Opt-in guard for the built-in routes. When set (even as `{}`), callers must be
   * logged in; reads need one of `read` (default: any user) and writes need one of
   * `write` (default: system_admin). When unset the routes are unguarded.
   */
  controllerAuth?: { read?: string[]; write?: string[] }
  /** Register the copy-task handler. Default: the value of `enableController`. */
  enableCopyTask?: boolean
  /**
   * Database the Prisma client talks to, which decides the search-filter syntax.
   * Default: detected from the Prisma client, falling back to 'postgresql'.
   */
  databaseProvider?: DatabaseProvider
}

export interface MasterModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  enableController?: boolean
  dataSyncHandlers?: Type<IDataSyncHandler>[]
  tableName?: string
  commonTenantCode?: string
  controllerAuth?: { read?: string[]; write?: string[] }
  enableCopyTask?: boolean
  databaseProvider?: DatabaseProvider
  inject?: any[]
  /**
   * Resolves the runtime module options. Must return the resolved PrismaService
   * **instance** under `prismaService` (typically by injecting it), so the master
   * services (which inject PRISMA_SERVICE) can be constructed. Optional only to
   * stay assignment-compatible with the inherited `registerAsync` signature;
   * omitting it makes PRISMA_SERVICE fail fast.
   */
  useFactory?: (
    ...args: any[]
  ) => Promise<{ prismaService?: any }> | { prismaService?: any }
}

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<MasterModuleOptions>().build()
