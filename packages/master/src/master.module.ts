import {
  CommandModule,
  DataStoreModule,
  QueueModule,
} from '@mbc-cqrs-serverless/core'
import { SequencesModule } from '@mbc-cqrs-serverless/sequence'
import { DynamicModule, Module } from '@nestjs/common'

import { TABLE_NAME } from './constants'
import { MasterDataController, MasterSettingController } from './controllers'
import { CustomTaskModule } from './custom-task/custom-task.module'
import { MasterSfnTaskEventHandler } from './handler/master-sfn-task.handler'
import {
  ConfigurableModuleClass,
  OPTIONS_TYPE,
  PRISMA_SERVICE,
} from './master.module-definition'
import { MasterDataService, MasterSettingService } from './services'

@Module({
  imports: [DataStoreModule, QueueModule],
  providers: [MasterDataService, MasterSettingService],
  exports: [MasterDataService, MasterSettingService],
})
export class MasterModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    const module = super.register(options)

    if (options.enableController) {
      if (!options.prismaService) {
        throw new Error(
          'PrismaService must be provided when enableController is true.',
        )
      }
      if (!module.controllers) {
        module.controllers = []
      }
      module.controllers.push(MasterDataController)
      module.controllers.push(MasterSettingController)

      if (!module.providers) {
        module.providers = []
      }

      module.providers.push({
        provide: PRISMA_SERVICE,
        useClass: options.prismaService,
      })
      module.providers.push(MasterSfnTaskEventHandler)

      if (!module.imports) {
        module.imports = []
      }
      module.imports.push(CustomTaskModule)
      module.imports.push(SequencesModule)
    }
    const imports = [...(module.imports ?? [])]

    imports.push(
      CommandModule.register({
        tableName: TABLE_NAME,
        dataSyncHandlers: options?.dataSyncHandlers,
      }),
    )

    return {
      ...module,
      imports,
    }
  }
}
