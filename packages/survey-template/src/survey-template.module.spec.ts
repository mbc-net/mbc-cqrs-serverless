import { CommandModule, StepFunctionService } from '@mbc-cqrs-serverless/core'
import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'

import { SurveyTemplateModule } from './survey-template.module'
import { SurveyTemplateService } from './survey-template.service'

class MockPrismaService {}

/**
 * Provides only globally-scoped app dependencies (ConfigService,
 * StepFunctionService) and the concrete PrismaService class. PRISMA_SERVICE is
 * intentionally NOT provided globally: the default data-sync handlers now resolve
 * it from SurveyTemplateModule's own scope, proving the module boots without the
 * app having to expose the token globally.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      load: [() => ({ NODE_ENV: 'local', APP_NAME: 'app' })],
    }),
  ],
  providers: [StepFunctionService, MockPrismaService],
  exports: [StepFunctionService, MockPrismaService],
})
class SupportModule {}

describe('SurveyTemplateModule', () => {
  afterEach(() => jest.restoreAllMocks())

  describe('register (sync)', () => {
    it('forwards the default table name to CommandModule', () => {
      const spy = jest.spyOn(CommandModule, 'register')
      SurveyTemplateModule.register({ prismaService: MockPrismaService })
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ tableName: 'survey' }),
      )
    })

    it('forwards a custom table name to CommandModule', () => {
      const spy = jest.spyOn(CommandModule, 'register')
      SurveyTemplateModule.register({
        prismaService: MockPrismaService,
        tableName: 'questionnaire',
      })
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ tableName: 'questionnaire' }),
      )
    })

    it('returns a DynamicModule even when enableController is false', () => {
      const mod = SurveyTemplateModule.register({
        prismaService: MockPrismaService,
        enableController: false,
      })
      expect(mod).toBeDefined()
      expect(mod.module).toBe(SurveyTemplateModule)
    })
  })

  describe('registerAsync', () => {
    it('compiles and resolves the public service (default table)', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          SupportModule,
          SurveyTemplateModule.registerAsync({
            inject: [MockPrismaService],
            useFactory: (prisma: MockPrismaService) => ({
              prismaService: prisma,
            }),
          }),
        ],
      }).compile()
      await moduleRef.init()

      const svc = moduleRef.get(SurveyTemplateService)
      expect(svc).toBeDefined()
      expect((svc as any).prismaService).toBeInstanceOf(MockPrismaService)
      await moduleRef.close()
    })
  })
})
