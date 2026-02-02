import {
  CommandModule,
  DataStoreModule,
  QueueModule,
} from '@mbc-cqrs-serverless/core'
import { DynamicModule, Module } from '@nestjs/common'

import { SurveyAnswerDataSyncRdsHandler } from './handler/survey-answer-rds.handler'
import { SurveyTemplateDataSyncRdsHandler } from './handler/survey-template-rds.handler'
import { SurveyAnswerController } from './survey-answer.controller'
import { SurveyAnswerService } from './survey-answer.service'
import { SurveyTemplateController } from './survey-template.controller'
import {
  ConfigurableModuleClass,
  OPTIONS_TYPE,
  PRISMA_SERVICE,
} from './survey-template.module-definition'
import { SurveyTemplateService } from './survey-template.service'

@Module({
  imports: [DataStoreModule, QueueModule],
  providers: [SurveyTemplateService, SurveyAnswerService],
  exports: [SurveyTemplateService, SurveyAnswerService],
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
      module.controllers.push(SurveyTemplateController, SurveyAnswerController)

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
            SurveyAnswerDataSyncRdsHandler,
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
