import { CommandModel, IDataSyncHandler } from '@mbc-cqrs-serverless/core'
import { Injectable, Logger } from '@nestjs/common'

@Injectable()
export class MasterDataSyncRdsHandler implements IDataSyncHandler {
  private readonly logger = new Logger(MasterDataSyncRdsHandler.name)

  constructor() {}

  async up(cmd: CommandModel): Promise<any> {
    this.logger.debug('up', cmd)
  }
  async down(cmd: CommandModel): Promise<any> {
    this.logger.debug('down', cmd)
  }
}
