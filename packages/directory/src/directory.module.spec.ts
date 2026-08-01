import { CommandModule, StepFunctionService } from '@mbc-cqrs-serverless/core'
import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'

import { DirectoryStorageModule } from './directory.module'
import { DirectoryService } from './directory.service'

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
  providers: [StepFunctionService, MockPrismaService],
  exports: [StepFunctionService, MockPrismaService],
})
class SupportModule {}

describe('DirectoryStorageModule', () => {
  afterEach(() => jest.restoreAllMocks())

  describe('register (sync)', () => {
    it('forwards the default table name to CommandModule', () => {
      const spy = jest.spyOn(CommandModule, 'register')
      DirectoryStorageModule.register({ prismaService: MockPrismaService })
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ tableName: 'directory' }),
      )
    })

    it('forwards a custom table name to CommandModule', () => {
      const spy = jest.spyOn(CommandModule, 'register')
      DirectoryStorageModule.register({
        prismaService: MockPrismaService,
        tableName: 'document',
      })
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ tableName: 'document' }),
      )
    })

    it('throws fast when prismaService is missing', () => {
      expect(() => DirectoryStorageModule.register({} as any)).toThrow(
        /prismaService/,
      )
    })
  })

  describe('registerAsync', () => {
    it('compiles and resolves the public service', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          SupportModule,
          DirectoryStorageModule.registerAsync({
            inject: [],
            useFactory: () => ({ prismaService: MockPrismaService }),
          }),
        ],
      }).compile()

      expect(moduleRef.get(DirectoryService)).toBeDefined()
      await moduleRef.close()
    })
  })
})
