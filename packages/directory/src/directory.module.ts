import {
  CommandModule,
  DataStoreModule,
  QueueModule,
} from '@mbc-cqrs-serverless/core'
import { DynamicModule, Module } from '@nestjs/common'

import { DirectoryController } from './directory.controller'
import {
  ConfigurableModuleClass,
  OPTIONS_TYPE,
  PRISMA_SERVICE,
} from './directory.module-definition'
import { DirectoryService } from './directory.service'
import { DirectoryFileService } from './directory-file.service'
import { DynamoService } from './dynamodb.service'

@Module({
  imports: [DataStoreModule, QueueModule],
  providers: [DirectoryService, DirectoryFileService, DynamoService],
  exports: [DirectoryService, DirectoryFileService, DynamoService],
})
export class SurveyTemplateModule extends ConfigurableModuleClass {
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
      module.controllers.push(DirectoryController)

      if (!module.providers) {
        module.providers = []
      }

      module.providers.push({
        provide: PRISMA_SERVICE,
        useExisting: options.prismaService,
      })

      if (!module.imports) {
        module.imports = []
      }
    }
    const imports = [...(module.imports ?? [])]

    imports.push(
      CommandModule.register({
        tableName: 'directory',
        dataSyncHandlers: options?.dataSyncHandlers,
      }),
    )

    return { ...module, imports }
  }
}
