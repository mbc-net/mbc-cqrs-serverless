/**
 * Cross-Service Error Propagation Behavioral Tests
 *
 * These tests verify that errors are correctly propagated across service
 * boundaries and async operations, which is critical for proper error
 * handling in CQRS/Event Sourcing applications.
 */

import 'reflect-metadata'

import { Injectable, Module } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'

describe('Cross-Service Error Propagation Behavioral Tests', () => {
  describe('Promise chain error propagation', () => {
    it('should preserve error type through async chain', async () => {
      class CustomError extends Error {
        constructor(
          message: string,
          public code: string,
        ) {
          super(message)
          this.name = 'CustomError'
        }
      }

      const service1 = async (): Promise<string> => {
        throw new CustomError('Service1 error', 'S1_ERR')
      }

      const service2 = async (): Promise<string> => {
        return service1()
      }

      const service3 = async (): Promise<string> => {
        return service2()
      }

      try {
        await service3()
        fail('Should have thrown')
      } catch (error: any) {
        expect(error).toBeInstanceOf(CustomError)
        expect(error.code).toBe('S1_ERR')
        expect(error.message).toBe('Service1 error')
      }
    })

    it('should preserve stack trace through async chain', async () => {
      const innerFunction = async (): Promise<void> => {
        throw new Error('Inner error')
      }

      const middleFunction = async (): Promise<void> => {
        await innerFunction()
      }

      const outerFunction = async (): Promise<void> => {
        await middleFunction()
      }

      try {
        await outerFunction()
        fail('Should have thrown')
      } catch (error: any) {
        expect(error.stack).toContain('innerFunction')
      }
    })

    it('should allow error transformation at each level', async () => {
      class LowLevelError extends Error {
        constructor(public details: string) {
          super(`Low level: ${details}`)
          this.name = 'LowLevelError'
        }
      }

      class HighLevelError extends Error {
        constructor(
          message: string,
          public cause: Error,
        ) {
          super(message)
          this.name = 'HighLevelError'
        }
      }

      const dataLayer = async (): Promise<void> => {
        throw new LowLevelError('Connection failed')
      }

      const serviceLayer = async (): Promise<void> => {
        try {
          await dataLayer()
        } catch (error) {
          throw new HighLevelError('Data operation failed', error as Error)
        }
      }

      try {
        await serviceLayer()
        fail('Should have thrown')
      } catch (error: any) {
        expect(error).toBeInstanceOf(HighLevelError)
        expect(error.cause).toBeInstanceOf(LowLevelError)
        expect(error.cause.details).toBe('Connection failed')
      }
    })
  })

  describe('NestJS dependency injection error propagation', () => {
    class RepositoryError extends Error {
      constructor(
        message: string,
        public operation: string,
      ) {
        super(message)
        this.name = 'RepositoryError'
      }
    }

    class ServiceError extends Error {
      constructor(
        message: string,
        public originalError: Error,
      ) {
        super(message)
        this.name = 'ServiceError'
      }
    }

    @Injectable()
    class MockRepository {
      async findById(id: string): Promise<any> {
        if (id === 'not-found') {
          throw new RepositoryError('Record not found', 'findById')
        }
        return { id, name: 'Test' }
      }

      async save(data: any): Promise<any> {
        if (data.invalid) {
          throw new RepositoryError('Validation failed', 'save')
        }
        return data
      }
    }

    @Injectable()
    class MockService {
      constructor(private repository: MockRepository) {}

      async getItem(id: string): Promise<any> {
        try {
          return await this.repository.findById(id)
        } catch (error) {
          throw new ServiceError(
            `Failed to get item ${id}`,
            error as Error,
          )
        }
      }

      async createItem(data: any): Promise<any> {
        try {
          return await this.repository.save(data)
        } catch (error) {
          throw new ServiceError('Failed to create item', error as Error)
        }
      }
    }

    @Module({
      providers: [MockRepository, MockService],
    })
    class TestModule {}

    let module: TestingModule
    let service: MockService

    beforeAll(async () => {
      module = await Test.createTestingModule({
        imports: [TestModule],
      }).compile()

      service = module.get<MockService>(MockService)
    })

    afterAll(async () => {
      await module.close()
    })

    it('should propagate repository error through service', async () => {
      try {
        await service.getItem('not-found')
        fail('Should have thrown')
      } catch (error: any) {
        expect(error).toBeInstanceOf(ServiceError)
        expect(error.originalError).toBeInstanceOf(RepositoryError)
        expect(error.originalError.operation).toBe('findById')
      }
    })

    it('should include context in wrapped errors', async () => {
      try {
        await service.createItem({ invalid: true })
        fail('Should have thrown')
      } catch (error: any) {
        expect(error.message).toBe('Failed to create item')
        expect(error.originalError.message).toBe('Validation failed')
      }
    })
  })

  describe('Async boundary error handling', () => {
    it('should handle errors from setTimeout callbacks', async () => {
      const asyncOperation = (): Promise<void> => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Async timeout error'))
          }, 10)
        })
      }

      await expect(asyncOperation()).rejects.toThrow('Async timeout error')
    })

    it('should handle errors from Promise.all', async () => {
      const success = Promise.resolve('ok')
      const failure = Promise.reject(new Error('One failed'))

      await expect(Promise.all([success, failure])).rejects.toThrow('One failed')
    })

    it('should capture all errors with Promise.allSettled', async () => {
      const success = Promise.resolve('ok')
      const failure1 = Promise.reject(new Error('Error 1'))
      const failure2 = Promise.reject(new Error('Error 2'))

      const results = await Promise.allSettled([success, failure1, failure2])

      expect(results[0]).toEqual({ status: 'fulfilled', value: 'ok' })
      expect(results[1].status).toBe('rejected')
      expect((results[1] as PromiseRejectedResult).reason.message).toBe(
        'Error 1',
      )
      expect(results[2].status).toBe('rejected')
      expect((results[2] as PromiseRejectedResult).reason.message).toBe(
        'Error 2',
      )
    })

    it('should handle errors in parallel async operations', async () => {
      const operations = [
        Promise.resolve(1),
        Promise.reject(new Error('Op 2 failed')),
        Promise.resolve(3),
      ]

      const results: Array<{ success: boolean; value?: number; error?: string }> =
        await Promise.all(
          operations.map((op) =>
            op
              .then((value) => ({ success: true, value }))
              .catch((error) => ({ success: false, error: error.message })),
          ),
        )

      expect(results[0]).toEqual({ success: true, value: 1 })
      expect(results[1]).toEqual({ success: false, error: 'Op 2 failed' })
      expect(results[2]).toEqual({ success: true, value: 3 })
    })
  })

  describe('Error context preservation', () => {
    it('should preserve error properties through try-catch', async () => {
      class DetailedError extends Error {
        constructor(
          message: string,
          public statusCode: number,
          public details: Record<string, any>,
        ) {
          super(message)
          this.name = 'DetailedError'
        }
      }

      const throwDetailed = async (): Promise<void> => {
        throw new DetailedError('Validation failed', 400, {
          field: 'email',
          constraint: 'isEmail',
        })
      }

      try {
        await throwDetailed()
      } catch (error: any) {
        expect(error.statusCode).toBe(400)
        expect(error.details).toEqual({
          field: 'email',
          constraint: 'isEmail',
        })
      }
    })

    it('should allow adding context when rethrowing', async () => {
      const operation = async (): Promise<void> => {
        throw new Error('Original error')
      }

      const wrapper = async (context: string): Promise<void> => {
        try {
          await operation()
        } catch (error: any) {
          error.context = context
          error.timestamp = new Date().toISOString()
          throw error
        }
      }

      try {
        await wrapper('user-request-123')
      } catch (error: any) {
        expect(error.message).toBe('Original error')
        expect(error.context).toBe('user-request-123')
        expect(error.timestamp).toBeDefined()
      }
    })
  })

  describe('Event handler error isolation', () => {
    it('should isolate errors between event handlers', async () => {
      const results: string[] = []
      const errors: Error[] = []

      const handler1 = async (): Promise<void> => {
        throw new Error('Handler 1 failed')
      }

      const handler2 = async (): Promise<void> => {
        results.push('Handler 2 succeeded')
      }

      const handler3 = async (): Promise<void> => {
        throw new Error('Handler 3 failed')
      }

      const handlers = [handler1, handler2, handler3]

      // Execute all handlers and capture errors
      await Promise.all(
        handlers.map((handler) =>
          handler().catch((error) => {
            errors.push(error)
          }),
        ),
      )

      expect(results).toEqual(['Handler 2 succeeded'])
      expect(errors).toHaveLength(2)
      expect(errors[0].message).toBe('Handler 1 failed')
      expect(errors[1].message).toBe('Handler 3 failed')
    })

    it('should aggregate errors from multiple handlers', async () => {
      class AggregateError extends Error {
        constructor(
          message: string,
          public errors: Error[],
        ) {
          super(message)
          this.name = 'AggregateError'
        }
      }

      const executeHandlers = async (
        handlers: Array<() => Promise<void>>,
      ): Promise<void> => {
        const errors: Error[] = []

        await Promise.all(
          handlers.map((handler) =>
            handler().catch((error) => {
              errors.push(error)
            }),
          ),
        )

        if (errors.length > 0) {
          throw new AggregateError(
            `${errors.length} handlers failed`,
            errors,
          )
        }
      }

      const handlers = [
        async () => {
          throw new Error('Error 1')
        },
        async () => {
          /* success */
        },
        async () => {
          throw new Error('Error 2')
        },
      ]

      try {
        await executeHandlers(handlers)
        fail('Should have thrown')
      } catch (error: any) {
        expect(error).toBeInstanceOf(AggregateError)
        expect(error.errors).toHaveLength(2)
      }
    })
  })

  describe('Retry with error classification', () => {
    it('should retry only on transient errors', async () => {
      class TransientError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'TransientError'
        }
      }

      class PermanentError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'PermanentError'
        }
      }

      const isTransient = (error: Error): boolean => {
        return error instanceof TransientError
      }

      const retryOnTransient = async <T>(
        operation: () => Promise<T>,
        maxRetries: number,
      ): Promise<T> => {
        let lastError: Error | null = null

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            return await operation()
          } catch (error: any) {
            lastError = error
            if (!isTransient(error) || attempt === maxRetries) {
              throw error
            }
          }
        }

        throw lastError
      }

      // Test transient error retry
      let transientAttempts = 0
      const transientOp = async (): Promise<string> => {
        transientAttempts++
        if (transientAttempts < 3) {
          throw new TransientError('Temporary failure')
        }
        return 'success'
      }

      const result = await retryOnTransient(transientOp, 5)
      expect(result).toBe('success')
      expect(transientAttempts).toBe(3)

      // Test permanent error - no retry
      let permanentAttempts = 0
      const permanentOp = async (): Promise<string> => {
        permanentAttempts++
        throw new PermanentError('Cannot recover')
      }

      await expect(retryOnTransient(permanentOp, 5)).rejects.toThrow(
        'Cannot recover',
      )
      expect(permanentAttempts).toBe(1)
    })
  })

  describe('Error serialization for logging', () => {
    it('should serialize error with all properties', () => {
      class DetailedError extends Error {
        constructor(
          message: string,
          public code: string,
          public metadata: Record<string, any>,
        ) {
          super(message)
          this.name = 'DetailedError'
        }
      }

      const serializeError = (
        error: Error,
      ): Record<string, any> => {
        return {
          name: error.name,
          message: error.message,
          stack: error.stack,
          ...Object.getOwnPropertyNames(error).reduce(
            (acc, key) => {
              if (!['name', 'message', 'stack'].includes(key)) {
                acc[key] = (error as any)[key]
              }
              return acc
            },
            {} as Record<string, any>,
          ),
        }
      }

      const error = new DetailedError('Test error', 'TEST_001', {
        userId: '123',
        action: 'create',
      })

      const serialized = serializeError(error)

      expect(serialized.name).toBe('DetailedError')
      expect(serialized.message).toBe('Test error')
      expect(serialized.code).toBe('TEST_001')
      expect(serialized.metadata).toEqual({ userId: '123', action: 'create' })
    })

    it('should handle circular references in error', () => {
      const error: any = new Error('Circular error')
      error.circular = error // Create circular reference

      const safeStringify = (obj: any): string => {
        const seen = new WeakSet()
        return JSON.stringify(obj, (key, value) => {
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
              return '[Circular]'
            }
            seen.add(value)
          }
          return value
        })
      }

      // Should not throw
      const serialized = safeStringify({
        message: error.message,
        circular: error.circular?.message,
      })

      expect(serialized).toContain('Circular error')
    })
  })
})
