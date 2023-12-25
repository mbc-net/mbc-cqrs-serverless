import { Type } from '@nestjs/common'

import { IDataSyncHandler } from './data-sync-handler.interface'

export interface CommandModuleOptions {
  tableName: string
  skipError?: boolean // true will skip previous command error
  dataSyncHandlers?: Type<IDataSyncHandler>[]
  disableDefaulHandler?: boolean // true will reset defaul data sync handlers
}
