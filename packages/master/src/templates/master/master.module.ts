import { CommandModule } from '@mbc-cqrs-serverless/core'
import { MasterModule as CoreMasterModule } from '@mbc-cqrs-serverless/master'
import { Module } from '@nestjs/common'
import { PrismaService } from 'src/prisma'

import { MasterDataSyncRdsHandler } from './handler/master-rds.handler'

@Module({
  imports: [
    CommandModule.register({
      tableName: 'master',
      dataSyncHandlers: [MasterDataSyncRdsHandler],
    }),
    CoreMasterModule.register({
      enableController: true,
      prismaService: PrismaService,
      dataSyncHandlers: [MasterDataSyncRdsHandler],
    }),
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class MasterModule {}
