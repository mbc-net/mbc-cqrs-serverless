import { CommandModule, StepFunctionService } from '@mbc-cqrs-serverless/core'
import { MasterModule } from '@mbc-cqrs-serverless/master'
import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'

import { SettingModule } from './setting.module'
import { SettingService } from './services/setting.service'

class MockPrismaService {}

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      load: [() => ({ NODE_ENV: 'local', APP_NAME: 'app' })],
    }),
  ],
  providers: [StepFunctionService],
  exports: [StepFunctionService],
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
  })
})
