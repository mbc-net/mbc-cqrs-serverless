// import { CommandModule } from '@mbc-cqrs-serverless/core'
// import { Module } from '@nestjs/common'

// import { SurveyTemplateDataSyncRdsHandler } from './handler/survey-template-rds.handler'
// import { SurveyTemplateController } from './survey-template.controller'
// import { SurveyTemplateService } from './survey-template.service'

// @Module({
//   imports: [
//     CommandModule.register({
//       tableName: 'survey',
//       dataSyncHandlers: [SurveyTemplateDataSyncRdsHandler],
//     }),
//   ],
//   controllers: [SurveyTemplateController],
//   providers: [SurveyTemplateService],
//   exports: [SurveyTemplateService],
// })
// export class SurveyTemplateModule {}

import {
  CommandModule,
  DataStoreModule,
  QueueModule,
} from '@mbc-cqrs-serverless/core'
import { DynamicModule, Module } from '@nestjs/common'

import { SurveyTemplateDataSyncRdsHandler } from './handler/survey-template-rds.handler'
import { SurveyTemplateController } from './survey-template.controller'
import {
  ConfigurableModuleClass,
  OPTIONS_TYPE,
  PRISMA_SERVICE,
} from './survey-template.module-definition'
import { SurveyTemplateService } from './survey-template.service'

@Module({
  imports: [DataStoreModule, QueueModule],
  providers: [SurveyTemplateService],
  exports: [SurveyTemplateService],
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
      module.controllers.push(SurveyTemplateController)

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

      const imports = [...(module.imports ?? [])]
      imports.push(
        CommandModule.register({
          tableName: 'survey',
          dataSyncHandlers: options?.dataSyncHandlers ?? [
            SurveyTemplateDataSyncRdsHandler,
          ],
        }),
      )
      return {
        ...module,
        imports,
      }
    }
  }
}
