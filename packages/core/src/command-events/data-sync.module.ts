import { Module } from '@nestjs/common'

import { DataSyncNewCommandEventHandler } from './data-sync.new.event.handler'
import { DataSyncCommandSfnEventHandler } from './data-sync.sfn.event.handler'

@Module({
  providers: [DataSyncNewCommandEventHandler, DataSyncCommandSfnEventHandler],
})
export class DataSyncModule {}
