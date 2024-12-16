import { DynamicModule, Module } from '@nestjs/common'

import { ExplorerService } from '../services'
import { CommandEventHandler } from './command.event.handler'
import {
  ConfigurableModuleClass,
  OPTIONS_TYPE,
} from './command.module-definition'
import { CommandService } from './command.service'
import { DataService } from './data.service'
import { DataSyncDdsHandler } from './handlers/data-sync-dds.handler'
import { HistoryService } from './history.service'
import { TtlService } from './ttl.service'

@Module({
  imports: [],
  providers: [
    ExplorerService,
    CommandService,
    DataService,
    TtlService,
    HistoryService,
    CommandEventHandler,
    DataSyncDdsHandler,
  ],
  exports: [
    CommandService,
    DataService,
    HistoryService,
    CommandEventHandler,
    TtlService,
  ],
})
export class CommandModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    const module = super.register(options)

    const { tableName, dataSyncHandlers = [] } = options
    module.providers.push(
      {
        // data-sync-handler uses dynamic command event handler to handle step function events of command execution
        provide: tableName + '_CommandEventHandler',
        useExisting: CommandEventHandler,
      },
      ...dataSyncHandlers,
    )

    return {
      ...module,
    }
  }
}
