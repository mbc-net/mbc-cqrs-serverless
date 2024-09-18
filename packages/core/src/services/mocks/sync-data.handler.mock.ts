import { Logger } from '@nestjs/common'

import { DataSyncHandler } from '../../decorators'
import { CommandModel, IDataSyncHandler } from '../../interfaces'

@DataSyncHandler('table_name')
export class DataSyncHandlerMock implements IDataSyncHandler {
  private readonly logger = new Logger(DataSyncHandlerMock.name)

  async up(cmd: CommandModel): Promise<any> {
    this.logger.debug(cmd)
  }
  async down(cmd: CommandModel): Promise<any> {
    this.logger.debug(cmd)
  }
}
