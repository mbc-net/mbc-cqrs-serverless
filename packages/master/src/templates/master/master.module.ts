import { MasterModule as CoreMasterModule } from '@mbc-cqrs-serverless/master'
import { Module } from '@nestjs/common'
import { PrismaService } from 'src/prisma'

import { MasterDataSyncRdsHandler } from './handler/master-rds.handler'

@Module({
  imports: [
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
