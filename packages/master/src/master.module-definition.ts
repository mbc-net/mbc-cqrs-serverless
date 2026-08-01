import { IDataSyncHandler } from '@mbc-cqrs-serverless/core'
import { ConfigurableModuleBuilder, ModuleMetadata, Type } from '@nestjs/common'

export const PRISMA_SERVICE = 'PrismaServiceInjectToken'

export interface MasterModuleOptions {
  enableController?: boolean
  dataSyncHandlers?: Type<IDataSyncHandler>[]
  prismaService?: Type<any>
  /** DynamoDB base table name. Default: 'master'. */
  tableName?: string
}

export interface MasterModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  enableController?: boolean
  dataSyncHandlers?: Type<IDataSyncHandler>[]
  tableName?: string
  inject?: any[]
  /**
   * Resolves the runtime module options. Must return at least `{ prismaService }`
   * so the master services (which inject PRISMA_SERVICE) can be constructed.
   * Optional only to stay assignment-compatible with the inherited
   * `registerAsync` signature; omitting it makes PRISMA_SERVICE fail fast.
   */
  useFactory?: (
    ...args: any[]
  ) =>
    | Promise<Pick<MasterModuleOptions, 'prismaService'>>
    | Pick<MasterModuleOptions, 'prismaService'>
}

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<MasterModuleOptions>().build()
