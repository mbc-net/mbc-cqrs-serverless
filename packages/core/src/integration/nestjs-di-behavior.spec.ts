/**
 * NestJS DI and Decorator Behavioral Tests
 *
 * These tests verify that NestJS dependency injection and decorators
 * behave as expected. When NestJS changes behavior, these tests will fail.
 */

import 'reflect-metadata'

import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  Module,
  NotFoundException,
  Optional,
  Scope,
  UnauthorizedException,
} from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'

describe('NestJS DI and Decorator Behavioral Tests', () => {
  describe('@Injectable decorator', () => {
    @Injectable()
    class SimpleService {
      getValue(): string {
        return 'simple-value'
      }
    }

    it('should create injectable service', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [SimpleService],
      }).compile()

      const service = module.get<SimpleService>(SimpleService)

      expect(service).toBeDefined()
      expect(service).toBeInstanceOf(SimpleService)
      expect(service.getValue()).toBe('simple-value')
    })

    it('should return same instance for default scope', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [SimpleService],
      }).compile()

      const service1 = module.get<SimpleService>(SimpleService)
      const service2 = module.get<SimpleService>(SimpleService)

      expect(service1).toBe(service2)
    })
  })

  describe('@Injectable with scope', () => {
    @Injectable({ scope: Scope.TRANSIENT })
    class TransientService {
      readonly instanceId = Math.random()
    }

    it('should create new instance for transient scope', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [TransientService],
      }).compile()

      const service1 = await module.resolve<TransientService>(TransientService)
      const service2 = await module.resolve<TransientService>(TransientService)

      expect(service1.instanceId).not.toBe(service2.instanceId)
    })
  })

  describe('@Inject decorator', () => {
    const CONFIG_TOKEN = 'CONFIG'

    @Injectable()
    class ConfigurableService {
      constructor(@Inject(CONFIG_TOKEN) public readonly config: object) {}
    }

    it('should inject using token', async () => {
      const configValue = { key: 'value', nested: { deep: true } }

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ConfigurableService,
          { provide: CONFIG_TOKEN, useValue: configValue },
        ],
      }).compile()

      const service = module.get<ConfigurableService>(ConfigurableService)

      expect(service.config).toBe(configValue)
      expect((service.config as { key: string }).key).toBe('value')
    })

    it('should fail when required dependency is missing', async () => {
      await expect(
        Test.createTestingModule({
          providers: [ConfigurableService],
        }).compile(),
      ).rejects.toThrow()
    })
  })

  describe('@Optional decorator', () => {
    const OPTIONAL_TOKEN = 'OPTIONAL'

    @Injectable()
    class OptionalDependencyService {
      constructor(
        @Optional() @Inject(OPTIONAL_TOKEN) public readonly optional?: string,
      ) {}
    }

    it('should allow missing optional dependency', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [OptionalDependencyService],
      }).compile()

      const service = module.get<OptionalDependencyService>(
        OptionalDependencyService,
      )

      expect(service).toBeDefined()
      expect(service.optional).toBeUndefined()
    })

    it('should inject optional dependency when provided', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          OptionalDependencyService,
          { provide: OPTIONAL_TOKEN, useValue: 'optional-value' },
        ],
      }).compile()

      const service = module.get<OptionalDependencyService>(
        OptionalDependencyService,
      )

      expect(service.optional).toBe('optional-value')
    })
  })

  describe('@Module decorator', () => {
    @Injectable()
    class ModuleService {
      getName(): string {
        return 'module-service'
      }
    }

    @Module({
      providers: [ModuleService],
      exports: [ModuleService],
    })
    class FeatureModule {}

    it('should import module and access exported providers', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [FeatureModule],
      }).compile()

      const service = module.get<ModuleService>(ModuleService)

      expect(service).toBeDefined()
      expect(service.getName()).toBe('module-service')
    })

    it('should isolate non-exported providers with strict mode', async () => {
      @Injectable()
      class PrivateService {}

      @Module({
        providers: [PrivateService, ModuleService],
        exports: [ModuleService], // PrivateService not exported
      })
      class IsolatedModule {}

      const module: TestingModule = await Test.createTestingModule({
        imports: [IsolatedModule],
      }).compile()

      // Should be able to get exported service
      expect(module.get<ModuleService>(ModuleService)).toBeDefined()

      // With strict: true, non-exported providers throw an error
      expect(() =>
        module.get<PrivateService>(PrivateService, { strict: true }),
      ).toThrow()
    })
  })

  describe('Dependency chain', () => {
    @Injectable()
    class RepositoryService {
      findAll(): string[] {
        return ['item1', 'item2']
      }
    }

    @Injectable()
    class BusinessService {
      constructor(private readonly repository: RepositoryService) {}

      getItems(): string[] {
        return this.repository.findAll()
      }
    }

    @Injectable()
    class FacadeService {
      constructor(private readonly business: BusinessService) {}

      getAllItems(): string[] {
        return this.business.getItems()
      }
    }

    it('should resolve deep dependency chain', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [RepositoryService, BusinessService, FacadeService],
      }).compile()

      const facade = module.get<FacadeService>(FacadeService)
      const items = facade.getAllItems()

      expect(items).toEqual(['item1', 'item2'])
    })
  })

  describe('Factory providers', () => {
    @Injectable()
    class DatabaseService {
      getConnection(): string {
        return 'db-connection'
      }
    }

    it('should create provider using factory', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DatabaseService,
          {
            provide: 'DB_CONNECTION',
            useFactory: (db: DatabaseService) => db.getConnection(),
            inject: [DatabaseService],
          },
        ],
      }).compile()

      const connection = module.get<string>('DB_CONNECTION')

      expect(connection).toBe('db-connection')
    })

    it('should support async factory', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: 'ASYNC_VALUE',
            useFactory: async () => {
              await new Promise((resolve) => setTimeout(resolve, 10))
              return 'async-result'
            },
          },
        ],
      }).compile()

      const value = module.get<string>('ASYNC_VALUE')

      expect(value).toBe('async-result')
    })
  })

  describe('Exception classes', () => {
    describe('HttpException', () => {
      it('should have correct status code', () => {
        const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST)

        expect(exception.getStatus()).toBe(400)
        expect(exception.getResponse()).toBe('Test error')
      })

      it('should support object response', () => {
        const response = { message: 'Validation failed', errors: ['field1'] }
        const exception = new HttpException(response, HttpStatus.BAD_REQUEST)

        expect(exception.getResponse()).toEqual(response)
      })
    })

    describe('Built-in exceptions', () => {
      it('BadRequestException should have status 400', () => {
        const exception = new BadRequestException('Bad request')
        expect(exception.getStatus()).toBe(400)
      })

      it('UnauthorizedException should have status 401', () => {
        const exception = new UnauthorizedException('Unauthorized')
        expect(exception.getStatus()).toBe(401)
      })

      it('ForbiddenException should have status 403', () => {
        const exception = new ForbiddenException('Forbidden')
        expect(exception.getStatus()).toBe(403)
      })

      it('NotFoundException should have status 404', () => {
        const exception = new NotFoundException('Not found')
        expect(exception.getStatus()).toBe(404)
      })

      it('InternalServerErrorException should have status 500', () => {
        const exception = new InternalServerErrorException('Server error')
        expect(exception.getStatus()).toBe(500)
      })
    })

    describe('Exception response structure', () => {
      it('should include statusCode and message in response', () => {
        const exception = new BadRequestException('Validation error')
        const response = exception.getResponse() as {
          statusCode: number
          message: string
        }

        expect(response.statusCode).toBe(400)
        expect(response.message).toBe('Validation error')
      })

      it('should include error name in response', () => {
        const exception = new NotFoundException('Resource not found')
        const response = exception.getResponse() as {
          error: string
        }

        expect(response.error).toBe('Not Found')
      })
    })
  })

  describe('Logger', () => {
    it('should create logger with context', () => {
      const logger = new Logger('TestContext')

      expect(logger).toBeDefined()
      // Logger methods should exist
      expect(typeof logger.log).toBe('function')
      expect(typeof logger.error).toBe('function')
      expect(typeof logger.warn).toBe('function')
      expect(typeof logger.debug).toBe('function')
      expect(typeof logger.verbose).toBe('function')
    })

    it('should allow static logger methods', () => {
      expect(typeof Logger.log).toBe('function')
      expect(typeof Logger.error).toBe('function')
      expect(typeof Logger.warn).toBe('function')
    })
  })

  describe('Provider overriding', () => {
    @Injectable()
    class RealService {
      getValue(): string {
        return 'real'
      }
    }

    @Injectable()
    class MockService {
      getValue(): string {
        return 'mock'
      }
    }

    it('should allow overriding providers in testing', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [RealService],
      })
        .overrideProvider(RealService)
        .useClass(MockService)
        .compile()

      const service = module.get<RealService>(RealService)

      expect(service.getValue()).toBe('mock')
    })

    it('should allow overriding with value', async () => {
      const mockValue = { getValue: () => 'value-mock' }

      const module: TestingModule = await Test.createTestingModule({
        providers: [RealService],
      })
        .overrideProvider(RealService)
        .useValue(mockValue)
        .compile()

      const service = module.get<RealService>(RealService)

      expect(service.getValue()).toBe('value-mock')
    })

    it('should allow overriding with factory', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [RealService],
      })
        .overrideProvider(RealService)
        .useFactory({ factory: () => ({ getValue: () => 'factory-mock' }) })
        .compile()

      const service = module.get<RealService>(RealService)

      expect(service.getValue()).toBe('factory-mock')
    })
  })

  describe('Circular dependency handling', () => {
    it('should detect and report circular dependencies', async () => {
      // This test verifies that NestJS properly handles/reports circular dependencies
      // In a real circular dependency case, NestJS would throw an error

      @Injectable()
      class ServiceA {
        constructor(@Inject('SERVICE_B') public b: object) {}
      }

      @Injectable()
      class ServiceB {
        constructor(@Inject('SERVICE_A') public a: object) {}
      }

      // Using forwardRef pattern to handle circular deps
      await expect(
        Test.createTestingModule({
          providers: [
            { provide: 'SERVICE_A', useClass: ServiceA },
            { provide: 'SERVICE_B', useClass: ServiceB },
          ],
        }).compile(),
      ).rejects.toThrow()
    })
  })
})
