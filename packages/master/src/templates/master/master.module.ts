import { CommandModule } from '@mbc-cqrs-serverless/core'
import { MasterModule as CoreMasterModule } from '@mbc-cqrs-serverless/master'
import { SequencesModule } from '@mbc-cqrs-serverless/sequence'
import { Module } from '@nestjs/common'
import { CustomTaskModule } from 'src/custom-task/custom-task.module'
import { PrismaService } from 'src/prisma'

import { MasterDataSyncRdsHandler } from './handler/master-rds.handler'
import { MasterSfnTaskEventHandler } from './handler/master-sfn-task.handler'
import { CustomMasterSettingController } from './master-setting.controller'
import { CustomMasterSettingService } from './master-setting.service'

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
    CustomTaskModule,
    SequencesModule,
  ],
  controllers: [CustomMasterSettingController],
  providers: [CustomMasterSettingService, MasterSfnTaskEventHandler],
  exports: [],
})
export class MasterModule {}
