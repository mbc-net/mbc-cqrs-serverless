import { DataStoreModule } from '@mbc-cqrs-severless/core'
import { DynamicModule, Module } from '@nestjs/common'

import { SequencesController } from './sequences.controller'
import {
  ConfigurableModuleClass,
  OPTIONS_TYPE,
} from './sequences.module-definition'
import { SequencesService } from './sequences.service'

@Module({
  imports: [DataStoreModule],
  providers: [SequencesService],
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
