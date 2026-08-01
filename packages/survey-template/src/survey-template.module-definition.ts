import { IDataSyncHandler } from '@mbc-cqrs-serverless/core'
import { ConfigurableModuleBuilder, ModuleMetadata, Type } from '@nestjs/common'

export const PRISMA_SERVICE = 'PrismaServiceInjectToken'

export const DEFAULT_SURVEY_TABLE_NAME = 'survey'

export interface SurveyTemplateModuleOptions {
  enableController?: boolean
  dataSyncHandlers?: Type<IDataSyncHandler>[]
  prismaService?: Type<any>
  /** DynamoDB base table name. Default: 'survey'. */
  tableName?: string
}

export interface SurveyTemplateModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  enableController?: boolean
  dataSyncHandlers?: Type<IDataSyncHandler>[]
  tableName?: string
  inject?: any[]
  /**
   * Resolves the runtime module options. Must return the resolved PrismaService
   * **instance** under `prismaService` (typically by injecting it), so the survey
   * services (which inject PRISMA_SERVICE) can be constructed. Optional only to
   * stay assignment-compatible with the inherited `registerAsync` signature;
   * omitting it makes PRISMA_SERVICE fail fast.
   */
  useFactory?: (
    ...args: any[]
  ) => Promise<{ prismaService?: any }> | { prismaService?: any }
}

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<SurveyTemplateModuleOptions>().build()
