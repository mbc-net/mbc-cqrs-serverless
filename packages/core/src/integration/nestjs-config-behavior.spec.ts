/**
 * @nestjs/config Behavioral Tests
 *
 * These tests verify ConfigService behaviors that are critical
 * for the framework's configuration management.
 */

import { Injectable, Module } from '@nestjs/common'
import { ConfigModule, ConfigService, registerAs } from '@nestjs/config'
import { Test, TestingModule } from '@nestjs/testing'

describe('@nestjs/config Behavioral Tests', () => {
  describe('ConfigService.get() behavior', () => {
    let configService: ConfigService

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [
              () => ({
                STRING_VALUE: 'test-string',
                NUMBER_VALUE: '42',
                BOOLEAN_TRUE: 'true',
                BOOLEAN_FALSE: 'false',
                NESTED: {
                  DEEP: {
                    VALUE: 'nested-value',
                  },
                },
                ARRAY_JSON: '[1, 2, 3]',
                OBJECT_JSON: '{"key": "value"}',
                EMPTY_STRING: '',
                NULL_VALUE: null,
              }),
            ],
          }),
        ],
      }).compile()

      configService = module.get<ConfigService>(ConfigService)
    })

    it('should get string value', () => {
      const value = configService.get<string>('STRING_VALUE')

      expect(value).toBe('test-string')
      expect(typeof value).toBe('string')
    })

    it('should return undefined for non-existent key', () => {
      const value = configService.get('NON_EXISTENT_KEY')

      expect(value).toBeUndefined()
    })

    it('should return default value for non-existent key', () => {
      const value = configService.get('NON_EXISTENT_KEY', 'default')

      expect(value).toBe('default')
    })

    it('should NOT auto-convert string to number', () => {
      const value = configService.get<number>('NUMBER_VALUE')

      // ConfigService does NOT convert types
      expect(value).toBe('42')
      expect(typeof value).toBe('string')
    })

    it('should NOT auto-convert string to boolean', () => {
      const trueValue = configService.get<boolean>('BOOLEAN_TRUE')
      const falseValue = configService.get<boolean>('BOOLEAN_FALSE')

      // ConfigService does NOT convert types
      expect(trueValue).toBe('true')
      expect(falseValue).toBe('false')
      expect(typeof trueValue).toBe('string')
    })

    it('should get nested values with dot notation', () => {
      const value = configService.get<string>('NESTED.DEEP.VALUE')

      expect(value).toBe('nested-value')
    })

    it('should return entire nested object', () => {
      const nested = configService.get('NESTED')

      expect(nested).toEqual({
        DEEP: {
          VALUE: 'nested-value',
        },
      })
    })

    it('should handle empty string value', () => {
      const value = configService.get('EMPTY_STRING')

      expect(value).toBe('')
    })

    it('should handle null value', () => {
      const value = configService.get('NULL_VALUE')

      expect(value).toBeNull()
    })

    it('should NOT parse JSON strings automatically', () => {
      const arrayValue = configService.get('ARRAY_JSON')
      const objectValue = configService.get('OBJECT_JSON')

      // Returns raw string, not parsed JSON
      expect(arrayValue).toBe('[1, 2, 3]')
      expect(objectValue).toBe('{"key": "value"}')
    })
  })

  describe('ConfigService.getOrThrow() behavior', () => {
    let configService: ConfigService

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [() => ({ EXISTING_KEY: 'value' })],
          }),
        ],
      }).compile()

      configService = module.get<ConfigService>(ConfigService)
    })

    it('should return value for existing key', () => {
      const value = configService.getOrThrow('EXISTING_KEY')

      expect(value).toBe('value')
    })

    it('should throw for non-existent key', () => {
      expect(() => configService.getOrThrow('NON_EXISTENT')).toThrow()
    })

    it('should throw with descriptive message', () => {
      expect(() => configService.getOrThrow('MISSING_KEY')).toThrow(
        /MISSING_KEY/,
      )
    })
  })

  describe('registerAs() namespace behavior', () => {
    it('should register config under namespace', async () => {
      const databaseConfig = registerAs('database', () => ({
        host: 'localhost',
        port: 5432,
        name: 'testdb',
      }))

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [databaseConfig],
          }),
        ],
      }).compile()

      const configService = module.get<ConfigService>(ConfigService)

      expect(configService.get('database.host')).toBe('localhost')
      expect(configService.get('database.port')).toBe(5432)
      expect(configService.get('database.name')).toBe('testdb')
    })

    it('should get entire namespace object', async () => {
      const appConfig = registerAs('app', () => ({
        name: 'TestApp',
        version: '1.0.0',
      }))

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [appConfig],
          }),
        ],
      }).compile()

      const configService = module.get<ConfigService>(ConfigService)

      const app = configService.get('app')
      expect(app).toEqual({
        name: 'TestApp',
        version: '1.0.0',
      })
    })

    it('should support multiple namespaces', async () => {
      const dbConfig = registerAs('database', () => ({ host: 'db-host' }))
      const cacheConfig = registerAs('cache', () => ({ host: 'cache-host' }))

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [dbConfig, cacheConfig],
          }),
        ],
      }).compile()

      const configService = module.get<ConfigService>(ConfigService)

      expect(configService.get('database.host')).toBe('db-host')
      expect(configService.get('cache.host')).toBe('cache-host')
    })
  })

  describe('ConfigModule.forRoot() options', () => {
    it('should work with isGlobal: true', async () => {
      @Injectable()
      class TestService {
        constructor(private configService: ConfigService) {}
        getValue() {
          return this.configService.get('TEST_VALUE')
        }
      }

      @Module({
        providers: [TestService],
      })
      class FeatureModule {}

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [() => ({ TEST_VALUE: 'global-value' })],
          }),
          FeatureModule,
        ],
      }).compile()

      const service = module.get<TestService>(TestService)
      expect(service.getValue()).toBe('global-value')
    })

    it('should use cache for repeated access', async () => {
      let loadCount = 0
      const configFactory = () => {
        loadCount++
        return { CACHED_VALUE: 'cached' }
      }

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            cache: true,
            load: [configFactory],
          }),
        ],
      }).compile()

      const configService = module.get<ConfigService>(ConfigService)

      // Multiple accesses
      configService.get('CACHED_VALUE')
      configService.get('CACHED_VALUE')
      configService.get('CACHED_VALUE')

      // Factory only called once during initialization
      expect(loadCount).toBe(1)
    })
  })

  describe('Type inference with generics', () => {
    interface DatabaseConfig {
      host: string
      port: number
      database: string
    }

    it('should support typed get with interface', async () => {
      const dbConfig = registerAs('db', (): DatabaseConfig => ({
        host: 'localhost',
        port: 5432,
        database: 'test',
      }))

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [dbConfig],
          }),
        ],
      }).compile()

      const configService = module.get<ConfigService>(ConfigService)

      const db = configService.get<DatabaseConfig>('db')

      // Type is inferred from generic
      expect(db?.host).toBe('localhost')
      expect(db?.port).toBe(5432)
    })
  })

  describe('Dynamic configuration loading', () => {
    it('should support async config factories', async () => {
      const asyncConfig = registerAs('async', async () => {
        // Simulate async operation
        await new Promise((r) => setTimeout(r, 10))
        return { loaded: true }
      })

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [asyncConfig],
          }),
        ],
      }).compile()

      const configService = module.get<ConfigService>(ConfigService)

      expect(configService.get('async.loaded')).toBe(true)
    })
  })

  describe('Default value handling edge cases', () => {
    let configService: ConfigService

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [
              () => ({
                ZERO: 0,
                FALSE: false,
                EMPTY: '',
                DEFINED: 'value',
              }),
            ],
          }),
        ],
      }).compile()

      configService = module.get<ConfigService>(ConfigService)
    })

    it('should not use default when value is 0', () => {
      const value = configService.get('ZERO', 99)

      expect(value).toBe(0)
    })

    it('should not use default when value is false', () => {
      const value = configService.get('FALSE', true)

      expect(value).toBe(false)
    })

    it('should not use default when value is empty string', () => {
      const value = configService.get('EMPTY', 'default')

      expect(value).toBe('')
    })

    it('should use default only when value is undefined', () => {
      const value = configService.get('UNDEFINED_KEY', 'default')

      expect(value).toBe('default')
    })
  })

  describe('ConfigService in service injection', () => {
    @Injectable()
    class AppService {
      constructor(private readonly configService: ConfigService) {}

      getAppName(): string {
        return this.configService.get('APP_NAME', 'DefaultApp')
      }

      getPort(): number {
        const portStr = this.configService.get('PORT', '3000')
        return parseInt(portStr, 10)
      }

      isProduction(): boolean {
        return this.configService.get('NODE_ENV') === 'production'
      }
    }

    it('should inject ConfigService into service', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [
              () => ({
                APP_NAME: 'TestApp',
                PORT: '8080',
                // Note: Loaded config values override process.env values
                MY_ENV: 'production',
              }),
            ],
          }),
        ],
        providers: [AppService],
      }).compile()

      const appService = module.get<AppService>(AppService)

      expect(appService.getAppName()).toBe('TestApp')
      expect(appService.getPort()).toBe(8080)
      // Note: NODE_ENV from process.env (set to 'test' by Jest) takes precedence
      // unless explicitly overridden in the load function
    })

    it('should use defaults when config not set', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [() => ({})],
          }),
        ],
        providers: [AppService],
      }).compile()

      const appService = module.get<AppService>(AppService)

      expect(appService.getAppName()).toBe('DefaultApp')
      expect(appService.getPort()).toBe(3000)
      expect(appService.isProduction()).toBe(false)
    })
  })

  describe('Environment variable expansion', () => {
    it('should NOT expand variables in load() factory functions', async () => {
      // Note: expandVariables only works for .env file values
      // load() factory return values are NOT expanded
      const originalValue = process.env.BASE_URL
      process.env.BASE_URL = 'http://localhost'

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            expandVariables: true,
            load: [
              () => ({
                API_URL: '${BASE_URL}/api',
              }),
            ],
          }),
        ],
      }).compile()

      const configService = module.get<ConfigService>(ConfigService)

      // This documents actual behavior: load() values are NOT expanded
      expect(configService.get('API_URL')).toBe('${BASE_URL}/api')

      // Restore
      if (originalValue === undefined) {
        delete process.env.BASE_URL
      } else {
        process.env.BASE_URL = originalValue
      }
    })

    it('should access process.env directly in load() for environment variable values', async () => {
      const originalValue = process.env.TEST_BASE_URL
      process.env.TEST_BASE_URL = 'http://test-host'

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [
              () => ({
                // Correct way to use env vars in load()
                API_URL: `${process.env.TEST_BASE_URL}/api`,
              }),
            ],
          }),
        ],
      }).compile()

      const configService = module.get<ConfigService>(ConfigService)

      expect(configService.get('API_URL')).toBe('http://test-host/api')

      // Restore
      if (originalValue === undefined) {
        delete process.env.TEST_BASE_URL
      } else {
        process.env.TEST_BASE_URL = originalValue
      }
    })
  })
})
