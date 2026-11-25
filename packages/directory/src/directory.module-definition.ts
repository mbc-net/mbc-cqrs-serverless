import { IDataSyncHandler } from '@mbc-cqrs-serverless/core'
import { ConfigurableModuleBuilder, ModuleMetadata, Type } from '@nestjs/common'

export const PRISMA_SERVICE = 'PrismaServiceInjectToken'

export const DEFAULT_DIRECTORY_TABLE_NAME = 'directory'
export const DEFAULT_DIRECTORY_PK_PREFIX = 'DIRECTORY'
export const DEFAULT_DIRECTORY_PRISMA_MODEL = 'directory'

export interface DirectoryStorageModuleOptions {
  enableController?: boolean
  dataSyncHandlers?: Type<IDataSyncHandler>[]
  prismaService?: Type<any>
  /** DynamoDB base table name. Default: 'directory'. */
  tableName?: string
  /** Partition-key prefix (before the key separator). Default: 'DIRECTORY'. */
  pkPrefix?: string
  /** Prisma model accessor used for RDS reads. Default: 'directory'. */
  prismaModelName?: string
}

export interface DirectoryStorageModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  enableController?: boolean
  dataSyncHandlers?: Type<IDataSyncHandler>[]
  tableName?: string
  pkPrefix?: string
  prismaModelName?: string
  inject?: any[]
  /**
   * Resolves the runtime module options. Must return the resolved PrismaService
   * **instance** under `prismaService` (typically by injecting it), so the domain
   * services (which inject PRISMA_SERVICE) can be constructed. Optional only to
   * stay assignment-compatible with the inherited `registerAsync` signature;
   * omitting it makes PRISMA_SERVICE fail fast.
   */
  useFactory?: (
    ...args: any[]
  ) => Promise<{ prismaService?: any }> | { prismaService?: any }
}

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<DirectoryStorageModuleOptions>().build()
