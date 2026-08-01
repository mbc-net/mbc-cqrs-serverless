import { CommandModule, StepFunctionService } from '@mbc-cqrs-serverless/core'
import { TaskService } from '@mbc-cqrs-serverless/task'
import { ConfigModule } from '@nestjs/config'
import { Global, Module } from '@nestjs/common'
import { Test } from '@nestjs/testing'

import { MasterModule } from './master.module'
import { MasterDataService } from './services'

class MockPrismaService {}

/**
 * Provides the globally-scoped dependencies a real app supplies
 * (ConfigService, StepFunctionService, TaskService, PrismaService) so the
 * module composed by registerAsync can be compiled in isolation.
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
    { provide: TaskService, useValue: {} },
  ],
  exports: [StepFunctionService, MockPrismaService, TaskService],
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
    it('compiles and resolves the public service (default table)', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          SupportModule,
          MasterModule.registerAsync({
            inject: [],
            useFactory: () => ({ prismaService: MockPrismaService }),
          }),
        ],
      }).compile()

      expect(moduleRef.get(MasterDataService)).toBeDefined()
      await moduleRef.close()
    })

    it('forwards a custom table name via registerAsync', () => {
      const spy = jest.spyOn(CommandModule, 'register')
      MasterModule.registerAsync({
        inject: [],
        useFactory: () => ({ prismaService: MockPrismaService }),
        tableName: 'custom-master',
      })
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ tableName: 'custom-master' }),
      )
    })
  })
})
