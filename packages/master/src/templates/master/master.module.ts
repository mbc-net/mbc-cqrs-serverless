import { CommandModule } from '@mbc-cqrs-serverless/core'
import { MasterModule as CoreMasterModule } from '@mbc-cqrs-serverless/master'
import { SequencesModule } from '@mbc-cqrs-serverless/sequence'
import { Module } from '@nestjs/common'
import { CustomTaskModule } from 'src/custom-task/custom-task.module'

import { MasterDataSyncRdsHandler } from './handler/master-rds.handler'
import { MasterSfnTaskEventHandler } from './handler/master-sfn-task.handler'
import { MasterDataController } from './master-data.controller'
import { CustomMasterDataService } from './master-data.service'
import { MasterSettingController } from './master-setting.controller'
import { CustomMasterSettingService } from './master-setting.service'

@Module({
  imports: [
    CommandModule.register({
      tableName: 'master',
      dataSyncHandlers: [MasterDataSyncRdsHandler],
    }),

    CoreMasterModule.register({
      enableController: false,
      dataSyncHandlers: [MasterDataSyncRdsHandler],
    }),
    CustomTaskModule,
    SequencesModule,
  ],
  controllers: [MasterDataController, MasterSettingController],
  providers: [
    CustomMasterDataService,
    CustomMasterSettingService,
    MasterSfnTaskEventHandler,
  ],
  exports: [CustomMasterSettingService, CoreMasterModule],
})
export class MasterModule {}
