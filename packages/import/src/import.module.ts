import { DataStoreModule, QueueModule } from '@mbc-cqrs-serverless/core'
import { DynamicModule, Module, Provider, Type } from '@nestjs/common'

import { CsvImportQueueEventHandler } from './event/csv-import.queue.event.handler'
import { CsvImportSfnEventHandler } from './event/csv-import.sfn.event.handler'
import { ImportEventHandler } from './event/import.event.handler'
import { ImportQueueEventHandler } from './event/import.queue.event.handler'
import { ImportController } from './import.controller'
import {
  ConfigurableModuleClass,
  IMPORT_STRATEGY_MAP,
  OPTIONS_TYPE,
  PROCESS_STRATEGY_MAP,
} from './import.module-definition'
import { ImportService } from './import.service'
import { ImportEntityProfile } from './interface'
import { IImportStrategy } from './interface/import-strategy.interface'
import { IProcessStrategy } from './interface/processing-strategy.interface'

@Module({
  imports: [DataStoreModule, QueueModule],
  providers: [
    ImportService,
    ImportEventHandler,
    ImportQueueEventHandler,
    CsvImportQueueEventHandler,
    CsvImportSfnEventHandler,
  ],
  exports: [ImportService],
})
export class ImportModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    const module = super.register(options)

    const { enableController, profiles, imports } = options

    module.imports = [...(module.imports || []), ...(imports || [])]

    const dynamicProviders: Provider[] = [
      this.createStrategyMapFactory(
        IMPORT_STRATEGY_MAP,
        profiles,
        (p) => p.importStrategy,
      ),
      this.createStrategyMapFactory(
        PROCESS_STRATEGY_MAP,
        profiles,
        (p) => p.processStrategy,
      ),
    ]

    module.providers = [...(module.providers || []), ...dynamicProviders]

    if (enableController) {
      module.controllers = [...(module.controllers || []), ImportController]
    }

    return module
  }

  /**
   * A private helper to create a factory provider for a strategy map.
   * This factory injects all necessary strategy instances and maps them
   * to their corresponding tableName from the profiles.
   */
  private static createStrategyMapFactory(
    provide: string,
    profiles: ImportEntityProfile[],
    classExtractor: (
      profile: ImportEntityProfile,
    ) => Type<IImportStrategy<any, any> | IProcessStrategy<any, any>>,
  ): Provider {
    // Extract the class types to be used as injection tokens
    const injectionTokens = profiles.map(classExtractor)

    return {
      provide,
      useFactory: (
        ...instances: (IImportStrategy<any, any> | IProcessStrategy<any, any>)[]
      ) => {
        const map = new Map<
          string,
          IImportStrategy<any, any> | IProcessStrategy<any, any>
        >()
        instances.forEach((instance, index) => {
          map.set(profiles[index].tableName, instance)
        })
        return map
      },
      inject: injectionTokens,
    }
  }
}
