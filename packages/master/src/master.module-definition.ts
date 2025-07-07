import { IDataSyncHandler } from '@mbc-cqrs-serverless/core'
import { ConfigurableModuleBuilder } from '@nestjs/common'
import { Type } from '@nestjs/common'

export const PRISMA_SERVICE = 'PrismaServiceInjectToken'

export interface MasterModuleOptions {
  enableController?: boolean
  dataSyncHandlers?: Type<IDataSyncHandler>[]
  prismaService?: Type<any>
}

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<MasterModuleOptions>().build()
