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
import { Repository } from './repository'
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
    Repository,
  ],
  exports: [
    CommandService,
    DataService,
    HistoryService,
    CommandEventHandler,
    TtlService,
    Repository,
  ],
})
export class CommandModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    const module = super.register(options)

    const {
      tableName,
      dataSyncHandlers = [],
      registerHandlerProviders = true,
      registerEventHandlerAlias = true,
    } = options

    // A module that defers the alias to another owner cannot run its own
    // data-sync handlers on the asynchronous (Step Functions) pipeline — that
    // pipeline only invokes the alias owner's CommandService. Fail fast rather
    // than dropping them silently for async commands.
    if (!registerEventHandlerAlias && dataSyncHandlers.length > 0) {
      throw new Error(
        `[${tableName}] dataSyncHandlers were provided together with ` +
          `registerEventHandlerAlias:false. These handlers would not run on the ` +
          `asynchronous (Step Functions) data-sync pipeline, which only invokes the ` +
          `owner of the '${tableName}_CommandEventHandler' alias. Register them on ` +
          `the alias-owning module instead.`,
      )
    }

    if (registerEventHandlerAlias) {
      module.providers.push({
        // data-sync-handler uses dynamic command event handler to handle step function events of command execution
        provide: tableName + '_CommandEventHandler',
        useExisting: CommandEventHandler,
      })
    }

    // When false, the handlers are provided by the importing (domain) module so
    // they can resolve domain-scoped tokens; CommandService still resolves them
    // globally via ModuleRef.get(HandlerClass, { strict: false }).
    if (registerHandlerProviders) {
      module.providers.push(...dataSyncHandlers)
    }

    return {
      ...module,
    }
  }
}
