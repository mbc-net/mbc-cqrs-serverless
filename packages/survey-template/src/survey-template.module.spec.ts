import { CommandModule, StepFunctionService } from '@mbc-cqrs-serverless/core'
import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'

import { PRISMA_SERVICE } from './survey-template.module-definition'
import { SurveyTemplateModule } from './survey-template.module'
import { SurveyTemplateService } from './survey-template.service'

class MockPrismaService {}

/**
 * Provides globally-scoped dependencies a real app supplies. PRISMA_SERVICE is
 * exposed globally because the default data-sync handlers are registered inside
 * the (child) CommandModule and inject the token across the module boundary —
 * this mirrors how a real app provides PrismaService globally.
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
  providers: [
    StepFunctionService,
    MockPrismaService,
    { provide: PRISMA_SERVICE, useClass: MockPrismaService },
  ],
  exports: [StepFunctionService, MockPrismaService, PRISMA_SERVICE],
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
            inject: [],
            useFactory: () => ({ prismaService: MockPrismaService }),
          }),
        ],
      }).compile()

      expect(moduleRef.get(SurveyTemplateService)).toBeDefined()
      await moduleRef.close()
    })
  })
})
