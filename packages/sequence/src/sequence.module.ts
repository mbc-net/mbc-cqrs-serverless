import { DataStoreModule } from '@mbc-cqrs-serverless/core'
import { DynamicModule, Module } from '@nestjs/common'

import {
  DEFAULT_MASTER_DATA,
  DEFAULT_VALUE_MASTER_DATA,
} from './constants/sequence.constant'
import { SequenceMasterDataProvider } from './sequence-master-factory'
import { SequencesController } from './sequences.controller'
import {
  ConfigurableModuleClass,
  OPTIONS_TYPE,
} from './sequences.module-definition'
import { SequencesService } from './sequences.service'

@Module({
  imports: [DataStoreModule],
  providers: [
    SequencesService,
    SequenceMasterDataProvider,
    {
      provide: DEFAULT_MASTER_DATA,
      useValue: DEFAULT_VALUE_MASTER_DATA,
    },
  ],
  exports: [SequencesService],
})
export class SequencesModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    const module = super.register(options)

    if (options.enableController) {
      if (!module.controllers) {
        module.controllers = []
      }
      module.controllers.push(SequencesController)
    }

    return {
      ...module,
    }
  }
}
