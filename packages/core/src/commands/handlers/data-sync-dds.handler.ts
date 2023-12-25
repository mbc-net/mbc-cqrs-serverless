import { Injectable, Logger } from '@nestjs/common'

import { CommandModel, IDataSyncHandler } from '../../interfaces'
import { DataService } from '../data.service'

@Injectable()
export class DataSyncDdsHandler implements IDataSyncHandler {
  private readonly logger = new Logger(DataSyncDdsHandler.name)

  constructor(private readonly dataService: DataService) {}

  async up(cmd: CommandModel): Promise<any> {
    this.logger.debug('dds up => ' + this.dataService.tableName, cmd)
    return await this.dataService.publish(cmd)
  }

  async down(cmd: CommandModel): Promise<any> {
    this.logger.debug('dds down::', cmd)
  }
}
