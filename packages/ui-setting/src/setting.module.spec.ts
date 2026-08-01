import { CommandModule, StepFunctionService } from '@mbc-cqrs-serverless/core'
import { MasterModule } from '@mbc-cqrs-serverless/master'
import { TaskService } from '@mbc-cqrs-serverless/task'
import { Global, Logger, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'

import { SettingModule } from './setting.module'
import { SettingService } from './services/setting.service'

class MockPrismaService {}

// A distinct handler so MasterModule's CommandModule options differ from
// SettingModule's — otherwise NestJS dedupes the two identical CommandModule
// registrations into one and there is no alias collision to detect.
class MasterRdsHandler {
  async up() {
    /* noop */
  }
  async down() {
    /* noop */
  }
}

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
    { provide: TaskService, useValue: {} },
  ],
  exports: [StepFunctionService, MockPrismaService, TaskService],
})
class SupportModule {}

describe('SettingModule', () => {
  afterEach(() => jest.restoreAllMocks())

  describe('register (sync)', () => {
    it('forwards the default table name (master) to CommandModule', () => {
      const spy = jest.spyOn(CommandModule, 'register')
      SettingModule.register({})
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ tableName: 'master' }),
      )
    })

    it('forwards a custom table name to CommandModule', () => {
      const spy = jest.spyOn(CommandModule, 'register')
      SettingModule.register({ tableName: 'ui-config' })
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ tableName: 'ui-config' }),
      )
    })
  })

  describe('registerAsync', () => {
    it('compiles and resolves the public service', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [SupportModule, SettingModule.registerAsync({ inject: [] })],
      }).compile()

      expect(moduleRef.get(SettingService)).toBeDefined()
      await moduleRef.close()
    })
  })

  describe('shared table with MasterModule', () => {
    it('registers CommandModule with the same table name for both modules', () => {
      const spy = jest.spyOn(CommandModule, 'register')
      MasterModule.register({
        prismaService: MockPrismaService,
        tableName: 'shared',
      })
      SettingModule.register({ tableName: 'shared' })

      const tableNames = spy.mock.calls.map((call) => call[0].tableName)
      expect(tableNames.filter((name) => name === 'shared').length).toBe(2)
    })

    it('warns but still boots when both modules own the same alias (backward compatible)', async () => {
      // The duplicate-alias guard warns (does not throw) so existing
      // MasterModule + SettingModule deployments keep booting. It runs in
      // CommandService.onModuleInit, triggered by init() (not compile()).
      const warnSpy = jest.spyOn(Logger.prototype, 'warn')
      const testingModule = await Test.createTestingModule({
        imports: [
          SupportModule,
          MasterModule.register({
            prismaService: MockPrismaService,
            dataSyncHandlers: [MasterRdsHandler as any],
          }),
          SettingModule.register({}),
        ],
      }).compile()

      await expect(testingModule.init()).resolves.toBeDefined()
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/CommandModule registrations own/),
      )
      await testingModule.close()
    })

    it('compiles when SettingModule defers the alias to MasterModule', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          SupportModule,
          MasterModule.register({
            prismaService: MockPrismaService,
            dataSyncHandlers: [MasterRdsHandler as any],
          }),
          SettingModule.register({ registerEventHandlerAlias: false }),
        ],
      }).compile()

      await moduleRef.init()
      expect(moduleRef.get(SettingService)).toBeDefined()
      await moduleRef.close()
    })

    it('rejects dataSyncHandlers combined with registerEventHandlerAlias:false', () => {
      expect(() =>
        SettingModule.register({
          registerEventHandlerAlias: false,
          dataSyncHandlers: [MasterRdsHandler as any],
        }),
      ).toThrow(/would not run on the asynchronous/)
    })

    it('fails fast when the alias is deferred but no module owns it', async () => {
      const testingModule = await Test.createTestingModule({
        imports: [
          SupportModule,
          SettingModule.register({ registerEventHandlerAlias: false }),
        ],
      }).compile()

      await expect(testingModule.init()).rejects.toThrow(
        /no other CommandModule owns/,
      )
    })
  })
})
