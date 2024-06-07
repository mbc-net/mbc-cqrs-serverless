import 'reflect-metadata'

import { DATA_SYNC_HANDLER_METADATA } from './constants'

export const DataSyncHandler = (commandTableName: string): ClassDecorator => {
  return (target: object) => {
    Reflect.defineMetadata(DATA_SYNC_HANDLER_METADATA, commandTableName, target)
  }
}
