import { DynamicModule, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { DynamoDbService } from '../data-store/dynamodb.service'
import { S3Service } from '../data-store/s3.service'
import { SessionService } from '../data-store/session.service'
import { validateStrictInlineOptions } from '../data-store/strict-inline-options'
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

/** Publication-only boundary; no projection/event-handler exports. */
@Module({})
class StrictInlineCommandModule {}

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
    validateStrictInlineOptions(options.safety)
    if (
      (options.safety !== undefined) !==
      (typeof options.strictDataStoreToken === 'symbol')
    ) {
      throw new Error('Strict inline profile requires a domain transport token')
    }
    if (!options.safety && options.strictDataStoreToken !== undefined) {
      throw new Error('Strict inline transport requires a profile')
    }
    if (options.safety) {
      options = Object.freeze({
        ...options,
        safety: Object.freeze({ profile: 'strict-inline-v1' as const }),
      })
    }
    const module = super.register(options)
    if (options.safety) {
      if (
        options.dataSyncHandlers?.length ||
        options.skipError ||
        options.registerEventHandlerAlias === true ||
        options.disableDefaultHandler === false
      ) {
        throw new Error(
          'Strict inline profile does not support data sync handlers',
        )
      }
      module.providers.push(
        ExplorerService,
        CommandService,
        DataService,
        TtlService,
        HistoryService,
        DataSyncDdsHandler,
        {
          provide: DynamoDbService,
          inject: [ConfigService, S3Service],
          useFactory: (config: ConfigService, s3: S3Service) =>
            new DynamoDbService(config, s3, options.safety),
        },
        {
          provide: SessionService,
          inject: [DynamoDbService, ConfigService],
          useFactory: (dynamo: DynamoDbService, config: ConfigService) =>
            new SessionService(dynamo, config),
        },
        { provide: options.strictDataStoreToken, useExisting: DynamoDbService },
      )
      return {
        ...module,
        module: StrictInlineCommandModule,
        exports: [CommandService, options.strictDataStoreToken],
      }
    }

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

  /**
   * Not supported. The `<tableName>_CommandEventHandler` alias and
   * dataSyncHandlers wiring must be composed at build time (the table name is a
   * deploy-time constant), which the inherited async builder cannot do — it
   * would silently produce a module with no alias, failing the Step Functions
   * data-sync pipeline at runtime. Use {@link CommandModule.register} (domain
   * modules compose it via `buildDomainCommandModule`).
   */
  static registerAsync(): DynamicModule {
    throw new Error(
      'CommandModule.registerAsync() is not supported: the table name must be ' +
        'known at build time to register the `<tableName>_CommandEventHandler` ' +
        'alias. Use CommandModule.register(), or a domain module that composes it ' +
        'via buildDomainCommandModule.',
    )
  }
}
