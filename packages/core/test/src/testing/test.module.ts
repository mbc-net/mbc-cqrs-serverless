import { Module } from '@nestjs/common'

import { CommandModule } from '../../../src'
import { TestSyncHandler } from './handler/test-sync.handler'
import { TestController } from './test.controller'

@Module({
  imports: [
    CommandModule.register({
      tableName: 'testing_table',
      dataSyncHandlers: [TestSyncHandler],
    }),
  ],
  controllers: [TestController],
})
export class TestModule {}
