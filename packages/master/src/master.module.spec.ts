import { CommandModule, StepFunctionService } from '@mbc-cqrs-serverless/core'
import { TaskService } from '@mbc-cqrs-serverless/task'
import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'

import { MasterModule } from './master.module'
import { MasterDataService } from './services'

class MockPrismaService {
  readonly kind = 'instance'
}

/**
 * Provides the globally-scoped dependencies a real app supplies. PrismaService
 * is provided via an ASYNC factory (mirroring PrismaModule.forRootAsync) so the
 * registerAsync path is exercised against the realistic ordering where the
 * Prisma instance is not available synchronously.
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
    { provide: TaskService, useValue: {} },
    {
      provide: MockPrismaService,
      useFactory: async () => {
        await new Promise((r) => setTimeout(r, 5))
        return new MockPrismaService()
      },
    },
  ],
  exports: [StepFunctionService, TaskService, MockPrismaService],
})
class SupportModule {}

describe('MasterModule', () => {
  afterEach(() => jest.restoreAllMocks())

  describe('register (sync)', () => {
    it('forwards the default table name to CommandModule', () => {
      const spy = jest.spyOn(CommandModule, 'register')
      MasterModule.register({ prismaService: MockPrismaService })
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ tableName: 'master' }),
      )
    })

    it('forwards a custom table name to CommandModule', () => {
      const spy = jest.spyOn(CommandModule, 'register')
      MasterModule.register({
        prismaService: MockPrismaService,
        tableName: 'custom-master',
      })
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ tableName: 'custom-master' }),
      )
    })

    it('throws fast when prismaService is missing', () => {
      expect(() => MasterModule.register({} as any)).toThrow(/prismaService/)
    })
  })

  describe('registerAsync', () => {
    it('resolves an async-provided PrismaService instance (not null)', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          SupportModule,
          MasterModule.registerAsync({
            inject: [MockPrismaService],
            useFactory: (prisma: MockPrismaService) => ({
              prismaService: prisma,
            }),
          }),
        ],
      }).compile()
      await moduleRef.init()

      const svc = moduleRef.get(MasterDataService)
      expect(svc).toBeDefined()
      // Regression: the injected PRISMA_SERVICE must be the resolved instance,
      // not null (async Prisma) and not the class reference.
      expect((svc as any).prismaService).toBeInstanceOf(MockPrismaService)
      expect((svc as any).prismaService.kind).toBe('instance')
      await moduleRef.close()
    })

    it('forwards a custom table name via registerAsync', () => {
      const spy = jest.spyOn(CommandModule, 'register')
      MasterModule.registerAsync({
        inject: [],
        useFactory: () => ({ prismaService: new MockPrismaService() }),
        tableName: 'custom-master',
      })
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ tableName: 'custom-master' }),
      )
    })
  })
})
