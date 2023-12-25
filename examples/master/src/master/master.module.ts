import { CommandModule } from '@mbc-cqrs-severless/core'
import { Module } from '@nestjs/common'

import { MasterDataSyncRdsHandler } from './handler/master-rds.handler'
import { MasterController } from './master.controller'
import { MasterService } from './master.service'

@Module({
  imports: [
    CommandModule.register({
      tableName: 'master',
      dataSyncHandlers: [MasterDataSyncRdsHandler],
    }),
  ],
  controllers: [MasterController],
  providers: [MasterService],
  exports: [MasterService],
})
export class MasterModule {}
