import {
  buildDomainCommandModule,
  buildPrismaProviderAsync,
  buildPrismaProviderSync,
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
  DEFAULT_SURVEY_TABLE_NAME,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  PRISMA_SERVICE,
  SurveyTemplateModuleAsyncOptions,
} from './survey-template.module-definition'
import { SurveyTemplateService } from './survey-template.service'

const DEFAULT_HANDLERS = [
  SurveyTemplateDataSyncRdsHandler,
  SurveyAnswerDataSyncRdsHandler,
]

@Module({
  imports: [DataStoreModule, QueueModule],
  providers: [SurveyTemplateService, SurveyAnswerService],
  exports: [SurveyTemplateService, SurveyAnswerService],
})
export class SurveyTemplateModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    const base = super.register(options)
    const providers = [...(base.providers ?? [])]
    const controllers = [...(base.controllers ?? [])]
    const imports = [...(base.imports ?? [])]

    // The survey services inject PRISMA_SERVICE unconditionally.
    providers.push(
      buildPrismaProviderSync(options.prismaService, PRISMA_SERVICE),
    )

    if (options.enableController) {
      controllers.push(SurveyTemplateController, SurveyAnswerController)
    }

    imports.push(
      buildDomainCommandModule(DEFAULT_SURVEY_TABLE_NAME, {
        tableName: options.tableName,
        dataSyncHandlers: options.dataSyncHandlers ?? DEFAULT_HANDLERS,
      }),
    )

    // Always return a DynamicModule, even when enableController is false.
    return { ...base, providers, controllers, imports }
  }

  static registerAsync(
    options: SurveyTemplateModuleAsyncOptions,
  ): DynamicModule {
    const base = super.registerAsync({
      imports: options.imports,
      inject: options.inject ?? [],
      useFactory: async (...args: any[]) => {
        const resolved = (await options.useFactory?.(...args)) ?? {}
        return {
          ...resolved,
          enableController: options.enableController,
          dataSyncHandlers: options.dataSyncHandlers,
          tableName: options.tableName ?? DEFAULT_SURVEY_TABLE_NAME,
        }
      },
    })
    const providers = [...(base.providers ?? [])]
    const controllers = [...(base.controllers ?? [])]
    const imports = [...(base.imports ?? [])]

    providers.push(
      buildPrismaProviderAsync(MODULE_OPTIONS_TOKEN, PRISMA_SERVICE),
    )

    if (options.enableController) {
      controllers.push(SurveyTemplateController, SurveyAnswerController)
    }

    imports.push(
      buildDomainCommandModule(DEFAULT_SURVEY_TABLE_NAME, {
        tableName: options.tableName,
        dataSyncHandlers: options.dataSyncHandlers ?? DEFAULT_HANDLERS,
      }),
    )

    return { ...base, providers, controllers, imports }
  }
}
