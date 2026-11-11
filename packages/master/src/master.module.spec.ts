import { CommandModule, StepFunctionService } from '@mbc-cqrs-serverless/core'
import { TaskService } from '@mbc-cqrs-serverless/task'
import { Global, Logger, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'

import { MasterSfnTaskEventHandler } from './handler/master-sfn-task.handler'
import { MasterModule } from './master.module'
import { MODULE_OPTIONS_TOKEN } from './master.module-definition'
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

    it('warns that renaming the central master table breaks TTL/sequence config', () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn')
      MasterModule.register({
        prismaService: MockPrismaService,
        tableName: 'catalog',
      })
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/central config|master-data|not fully supported/),
      )
    })

    it('does not warn for the default master table', () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn')
      MasterModule.register({ prismaService: MockPrismaService })
      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.stringMatching(/not fully supported/),
      )
    })
  })

  describe('controllerAuth and enableCopyTask', () => {
    const warnedUnguarded = (spy: jest.SpyInstance) =>
      spy.mock.calls.some(([m]) => /controllerAuth/.test(m))

    it('warns when controllers are enabled without controllerAuth', () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn')
      MasterModule.register({
        prismaService: MockPrismaService,
        enableController: true,
      })
      expect(warnedUnguarded(warnSpy)).toBe(true)
    })

    it('does not warn when controllerAuth is set', () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn')
      MasterModule.register({
        prismaService: MockPrismaService,
        enableController: true,
        controllerAuth: {},
      })
      expect(warnedUnguarded(warnSpy)).toBe(false)
    })

    it('registers the copy handler with enableCopyTask and no controllers', () => {
      const mod = MasterModule.register({
        prismaService: MockPrismaService,
        enableCopyTask: true,
      })
      expect(mod.providers).toContain(MasterSfnTaskEventHandler)
      expect(mod.controllers).toHaveLength(0)
    })

    it('defaults enableCopyTask to enableController', () => {
      const on = MasterModule.register({
        prismaService: MockPrismaService,
        enableController: true,
        controllerAuth: {},
      })
      const off = MasterModule.register({ prismaService: MockPrismaService })
      expect(on.providers).toContain(MasterSfnTaskEventHandler)
      expect(off.providers).not.toContain(MasterSfnTaskEventHandler)
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

    it('passes controllerAuth through to the resolved module options', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          SupportModule,
          MasterModule.registerAsync({
            inject: [MockPrismaService],
            useFactory: (prisma: MockPrismaService) => ({
              prismaService: prisma,
            }),
            controllerAuth: { write: ['editor'] },
          }),
        ],
      }).compile()
      expect(moduleRef.get(MODULE_OPTIONS_TOKEN).controllerAuth).toEqual({
        write: ['editor'],
      })
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

    it('rejects a useFactory that returns the PrismaService class instead of an instance', async () => {
      await expect(
        Test.createTestingModule({
          imports: [
            SupportModule,
            MasterModule.registerAsync({
              inject: [],
              // wrong: returns the class, not an instance
              useFactory: () => ({ prismaService: MockPrismaService }),
            }),
          ],
        }).compile(),
      ).rejects.toThrow(/CLASS, not an instance/)
    })
  })

  describe('CommandModule.registerAsync guard', () => {
    it('throws a clear error (not supported)', () => {
      expect(() => (CommandModule as any).registerAsync({})).toThrow(
        /not supported/,
      )
    })
  })
})
