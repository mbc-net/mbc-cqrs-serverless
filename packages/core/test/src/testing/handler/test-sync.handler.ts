import { Injectable, Logger } from '@nestjs/common'

import { CommandModel, IDataSyncHandler } from '../../../../src'

@Injectable()
export class TestSyncHandler implements IDataSyncHandler {
  private readonly logger = new Logger(TestSyncHandler.name)

  async up(cmd: CommandModel): Promise<any> {
    this.logger.debug('TestSyncHandler.up', cmd)
  }
  async down(cmd: CommandModel): Promise<any> {
    this.logger.debug('TestSyncHandler.down', cmd)
  }
}
