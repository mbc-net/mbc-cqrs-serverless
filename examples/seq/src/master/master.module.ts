import { CommandModule } from '@mbc-cqrs-sererless/core'
import { SequencesModule } from '@mbc-cqrs-sererless/sequence'
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
    SequencesModule,
  ],
  controllers: [MasterController],
  providers: [MasterService],
  exports: [MasterService],
})
export class MasterModule {}
