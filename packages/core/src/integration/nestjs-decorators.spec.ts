/**
 * NestJS Decorators Integration Tests
 *
 * This file tests NestJS Guards, Pipes, and Interceptors behavior:
 * - ExecutionContext interface compatibility
 * - CallHandler interface compatibility
 * - PipeTransform interface compatibility
 * - CanActivate interface compatibility
 * - Metadata reflection
 *
 * These tests verify that NestJS decorator patterns work correctly
 * across package version updates.
 */
import {
  ArgumentMetadata,
  BadRequestException,
  CallHandler,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
  PipeTransform,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable, of, throwError } from 'rxjs'
import { catchError, map, tap, timeout } from 'rxjs/operators'

describe('NestJS Decorators Integration', () => {
  // ============================================================================
  // ExecutionContext Tests
  // ============================================================================
  describe('ExecutionContext Interface', () => {
    /**
     * Creates a mock ExecutionContext for testing
     */
    function createMockExecutionContext(
      type: 'http' | 'rpc' | 'ws' = 'http',
      requestData: Record<string, unknown> = {},
    ): ExecutionContext {
      const mockRequest = {
        method: 'GET',
        url: '/test',
        headers: {},
        user: null,
        ...requestData,
      }

      const mockResponse = {
        statusCode: 200,
        setHeader: jest.fn(),
      }

      return {
        getType: () => type,
        getClass: () => class TestController {},
        getHandler: () => function testHandler() {},
        getArgs: () => [mockRequest, mockResponse],
        getArgByIndex: (index: number) =>
          [mockRequest, mockResponse][index] ?? null,
        switchToHttp: () => ({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
          getNext: () => jest.fn(),
        }),
        switchToRpc: () => ({
          getData: () => ({}),
          getContext: () => ({}),
        }),
        switchToWs: () => ({
          getData: () => ({}),
          getClient: () => ({}),
          getPattern: () => 'test-pattern',
        }),
      } as unknown as ExecutionContext
    }

    describe('Context type switching', () => {
      it('should handle HTTP context', () => {
        const context = createMockExecutionContext('http')

        expect(context.getType()).toBe('http')

        const httpContext = context.switchToHttp()
        const request = httpContext.getRequest()

        expect(request.method).toBe('GET')
        expect(request.url).toBe('/test')
      })

      it('should handle RPC context', () => {
        const context = createMockExecutionContext('rpc')

        expect(context.getType()).toBe('rpc')

        const rpcContext = context.switchToRpc()
        expect(rpcContext.getData()).toBeDefined()
        expect(rpcContext.getContext()).toBeDefined()
      })

      it('should handle WebSocket context', () => {
        const context = createMockExecutionContext('ws')

        expect(context.getType()).toBe('ws')

        const wsContext = context.switchToWs()
        expect(wsContext.getData()).toBeDefined()
        expect(wsContext.getClient()).toBeDefined()
        expect(wsContext.getPattern()).toBe('test-pattern')
      })

      it('should provide class and handler info', () => {
        const context = createMockExecutionContext()

        expect(context.getClass()).toBeDefined()
        expect(context.getHandler()).toBeDefined()
        expect(typeof context.getHandler()).toBe('function')
      })

      it('should provide arguments access', () => {
        const context = createMockExecutionContext()

        const args = context.getArgs()
        expect(args).toHaveLength(2)
        expect(context.getArgByIndex(0)).toBeDefined()
        expect(context.getArgByIndex(1)).toBeDefined()
      })
    })

    describe('Request data extraction', () => {
      it('should extract user from request', () => {
        const context = createMockExecutionContext('http', {
          user: { id: 'user-123', role: 'admin' },
        })

        const request = context.switchToHttp().getRequest()
        expect(request.user).toEqual({ id: 'user-123', role: 'admin' })
      })

      it('should extract headers from request', () => {
        const context = createMockExecutionContext('http', {
          headers: {
            authorization: 'Bearer token123',
            'content-type': 'application/json',
          },
        })

        const request = context.switchToHttp().getRequest()
        expect(request.headers.authorization).toBe('Bearer token123')
      })
    })
  })

  // ============================================================================
  // Guard Tests
  // ============================================================================
  describe('CanActivate Interface', () => {
    /**
     * Test Guard implementation
     */
    @Injectable()
    class TestGuard implements CanActivate {
      canActivate(
        context: ExecutionContext,
      ): boolean | Promise<boolean> | Observable<boolean> {
        const request = context.switchToHttp().getRequest()
        return !!request.user
      }
    }

    /**
     * Role-based Guard
     */
    @Injectable()
    class RoleGuard implements CanActivate {
      constructor(private readonly reflector: Reflector) {}

      canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.get<string[]>(
          'roles',
          context.getHandler(),
        )

        if (!requiredRoles || requiredRoles.length === 0) {
          return true
        }

        const request = context.switchToHttp().getRequest()
        const user = request.user as { roles?: string[] } | null

        if (!user || !user.roles) {
          return false
        }

        return requiredRoles.some((role) => user.roles!.includes(role))
      }
    }

    /**
     * Async Guard
     */
    @Injectable()
    class AsyncGuard implements CanActivate {
      async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest()

        // Simulate async operation (e.g., database lookup)
        await new Promise((resolve) => setTimeout(resolve, 10))

        return request.headers.authorization?.startsWith('Bearer ')
      }
    }

    /**
     * Observable Guard
     */
    @Injectable()
    class ObservableGuard implements CanActivate {
      canActivate(context: ExecutionContext): Observable<boolean> {
        const request = context.switchToHttp().getRequest()

        return of(!!request.user).pipe(
          map((hasUser) => hasUser && request.method === 'GET'),
        )
      }
    }

    function createMockContext(
      requestData: Record<string, unknown> = {},
    ): ExecutionContext {
      const request = { method: 'GET', url: '/test', headers: {}, ...requestData }
      return {
        getType: () => 'http',
        getClass: () => class {},
        getHandler: () => function () {},
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      } as unknown as ExecutionContext
    }

    describe('Synchronous guard', () => {
      it('should return true when user exists', () => {
        const guard = new TestGuard()
        const context = createMockContext({ user: { id: '123' } })

        expect(guard.canActivate(context)).toBe(true)
      })

      it('should return false when user is missing', () => {
        const guard = new TestGuard()
        const context = createMockContext({ user: null })

        expect(guard.canActivate(context)).toBe(false)
      })
    })

    describe('Role-based guard', () => {
      it('should allow access for matching role', () => {
        const mockReflector = {
          get: jest.fn().mockReturnValue(['admin']),
        } as unknown as Reflector

        const guard = new RoleGuard(mockReflector)
        const context = createMockContext({
          user: { id: '123', roles: ['admin', 'user'] },
        })

        expect(guard.canActivate(context)).toBe(true)
      })

      it('should deny access for non-matching role', () => {
        const mockReflector = {
          get: jest.fn().mockReturnValue(['admin']),
        } as unknown as Reflector

        const guard = new RoleGuard(mockReflector)
        const context = createMockContext({
          user: { id: '123', roles: ['user'] },
        })

        expect(guard.canActivate(context)).toBe(false)
      })

      it('should allow access when no roles required', () => {
        const mockReflector = {
          get: jest.fn().mockReturnValue([]),
        } as unknown as Reflector

        const guard = new RoleGuard(mockReflector)
        const context = createMockContext({ user: null })

        expect(guard.canActivate(context)).toBe(true)
      })
    })

    describe('Async guard', () => {
      it('should resolve to true with valid bearer token', async () => {
        const guard = new AsyncGuard()
        const context = createMockContext({
          headers: { authorization: 'Bearer valid-token' },
        })

        await expect(guard.canActivate(context)).resolves.toBe(true)
      })

      it('should resolve to false without bearer token', async () => {
        const guard = new AsyncGuard()
        const context = createMockContext({
          headers: { authorization: 'Basic credentials' },
        })

        await expect(guard.canActivate(context)).resolves.toBe(false)
      })
    })

    describe('Observable guard', () => {
      it('should emit true for valid request', (done) => {
        const guard = new ObservableGuard()
        const context = createMockContext({
          user: { id: '123' },
          method: 'GET',
        })

        const result = guard.canActivate(context) as Observable<boolean>
        result.subscribe({
          next: (value) => {
            expect(value).toBe(true)
            done()
          },
        })
      })

      it('should emit false for POST method with user', (done) => {
        const guard = new ObservableGuard()
        const context = createMockContext({
          user: { id: '123' },
          method: 'POST',
        })

        const result = guard.canActivate(context) as Observable<boolean>
        result.subscribe({
          next: (value) => {
            expect(value).toBe(false)
            done()
          },
        })
      })
    })
  })

  // ============================================================================
  // Pipe Tests
  // ============================================================================
  describe('PipeTransform Interface', () => {
    /**
     * Validation Pipe
     */
    @Injectable()
    class ValidationPipe implements PipeTransform {
      transform(value: unknown, metadata: ArgumentMetadata): unknown {
        if (metadata.type === 'body' && !value) {
          throw new BadRequestException('Body is required')
        }
        return value
      }
    }

    /**
     * ParseInt Pipe
     */
    @Injectable()
    class ParseIntPipe implements PipeTransform<string, number> {
      transform(value: string, metadata: ArgumentMetadata): number {
        const parsedValue = parseInt(value, 10)

        if (isNaN(parsedValue)) {
          throw new BadRequestException(
            `${metadata.data || 'Value'} must be a number`,
          )
        }

        return parsedValue
      }
    }

    /**
     * Trim Pipe
     */
    @Injectable()
    class TrimPipe implements PipeTransform<string, string> {
      transform(value: string): string {
        if (typeof value !== 'string') {
          return value
        }
        return value.trim()
      }
    }

    /**
     * Default Value Pipe
     */
    @Injectable()
    class DefaultValuePipe implements PipeTransform {
      constructor(private readonly defaultValue: unknown) {}

      transform(value: unknown): unknown {
        return value ?? this.defaultValue
      }
    }

    /**
     * Async Validation Pipe
     */
    @Injectable()
    class AsyncValidationPipe implements PipeTransform {
      async transform(
        value: unknown,
        metadata: ArgumentMetadata,
      ): Promise<unknown> {
        // Simulate async validation (e.g., checking against database)
        await new Promise((resolve) => setTimeout(resolve, 10))

        if (metadata.type === 'param' && metadata.data === 'id') {
          const id = value as string
          if (!id.match(/^[a-z0-9-]+$/)) {
            throw new BadRequestException('Invalid ID format')
          }
        }

        return value
      }
    }

    describe('Synchronous pipe', () => {
      it('should pass through valid body', () => {
        const pipe = new ValidationPipe()
        const metadata: ArgumentMetadata = { type: 'body', metatype: Object }

        const result = pipe.transform({ name: 'test' }, metadata)
        expect(result).toEqual({ name: 'test' })
      })

      it('should throw for missing body', () => {
        const pipe = new ValidationPipe()
        const metadata: ArgumentMetadata = { type: 'body', metatype: Object }

        expect(() => pipe.transform(null, metadata)).toThrow(BadRequestException)
      })

      it('should allow null for non-body types', () => {
        const pipe = new ValidationPipe()
        const metadata: ArgumentMetadata = { type: 'query', metatype: String }

        const result = pipe.transform(null, metadata)
        expect(result).toBeNull()
      })
    })

    describe('ParseInt pipe', () => {
      it('should parse valid integer string', () => {
        const pipe = new ParseIntPipe()
        const metadata: ArgumentMetadata = {
          type: 'param',
          data: 'id',
          metatype: Number,
        }

        expect(pipe.transform('123', metadata)).toBe(123)
      })

      it('should throw for non-numeric string', () => {
        const pipe = new ParseIntPipe()
        const metadata: ArgumentMetadata = {
          type: 'param',
          data: 'id',
          metatype: Number,
        }

        expect(() => pipe.transform('abc', metadata)).toThrow(BadRequestException)
      })

      it('should include parameter name in error', () => {
        const pipe = new ParseIntPipe()
        const metadata: ArgumentMetadata = {
          type: 'param',
          data: 'userId',
          metatype: Number,
        }

        expect(() => pipe.transform('abc', metadata)).toThrow(
          'userId must be a number',
        )
      })
    })

    describe('Trim pipe', () => {
      it('should trim whitespace from string', () => {
        const pipe = new TrimPipe()
        expect(pipe.transform('  hello world  ')).toBe('hello world')
      })

      it('should handle non-string values', () => {
        const pipe = new TrimPipe()
        expect(pipe.transform(123 as unknown as string)).toBe(123)
      })
    })

    describe('Default value pipe', () => {
      it('should return value when present', () => {
        const pipe = new DefaultValuePipe('default')
        expect(pipe.transform('provided')).toBe('provided')
      })

      it('should return default for null', () => {
        const pipe = new DefaultValuePipe('default')
        expect(pipe.transform(null)).toBe('default')
      })

      it('should return default for undefined', () => {
        const pipe = new DefaultValuePipe(10)
        expect(pipe.transform(undefined)).toBe(10)
      })

      it('should not replace falsy values like 0 or empty string', () => {
        const pipe = new DefaultValuePipe('default')
        expect(pipe.transform(0)).toBe(0)
        expect(pipe.transform('')).toBe('')
        expect(pipe.transform(false)).toBe(false)
      })
    })

    describe('Async validation pipe', () => {
      it('should resolve valid ID', async () => {
        const pipe = new AsyncValidationPipe()
        const metadata: ArgumentMetadata = {
          type: 'param',
          data: 'id',
          metatype: String,
        }

        await expect(pipe.transform('valid-id-123', metadata)).resolves.toBe(
          'valid-id-123',
        )
      })

      it('should reject invalid ID format', async () => {
        const pipe = new AsyncValidationPipe()
        const metadata: ArgumentMetadata = {
          type: 'param',
          data: 'id',
          metatype: String,
        }

        await expect(pipe.transform('INVALID_ID!', metadata)).rejects.toThrow(
          BadRequestException,
        )
      })
    })
  })

  // ============================================================================
  // Interceptor Tests
  // ============================================================================
  describe('NestInterceptor Interface', () => {
    /**
     * Logging Interceptor
     */
    @Injectable()
    class LoggingInterceptor implements NestInterceptor {
      private logs: string[] = []

      intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const now = Date.now()
        const request = context.switchToHttp().getRequest()

        this.logs.push(`Before: ${request.method} ${request.url}`)

        return next.handle().pipe(
          tap(() => {
            const elapsed = Date.now() - now
            this.logs.push(`After: ${elapsed}ms`)
          }),
        )
      }

      getLogs(): string[] {
        return this.logs
      }
    }

    /**
     * Transform Response Interceptor
     */
    @Injectable()
    class TransformInterceptor implements NestInterceptor {
      intercept(
        _context: ExecutionContext,
        next: CallHandler,
      ): Observable<{ data: unknown; timestamp: string }> {
        return next.handle().pipe(
          map((data) => ({
            data,
            timestamp: new Date().toISOString(),
          })),
        )
      }
    }

    /**
     * Error Handling Interceptor
     */
    @Injectable()
    class ErrorInterceptor implements NestInterceptor {
      intercept(
        _context: ExecutionContext,
        next: CallHandler,
      ): Observable<unknown> {
        return next.handle().pipe(
          catchError((err) => {
            if (err.status === 401) {
              return throwError(() => new UnauthorizedException('Custom: ' + err.message))
            }
            if (err.status === 403) {
              return throwError(() => new ForbiddenException('Custom: ' + err.message))
            }
            return throwError(() => err)
          }),
        )
      }
    }

    /**
     * Timeout Interceptor
     */
    @Injectable()
    class TimeoutInterceptor implements NestInterceptor {
      constructor(private readonly timeoutMs: number = 5000) {}

      intercept(
        _context: ExecutionContext,
        next: CallHandler,
      ): Observable<unknown> {
        return next.handle().pipe(timeout(this.timeoutMs))
      }
    }

    /**
     * Cache Interceptor
     */
    @Injectable()
    class CacheInterceptor implements NestInterceptor {
      private cache = new Map<string, { data: unknown; expires: number }>()

      constructor(private readonly ttlMs: number = 60000) {}

      intercept(
        context: ExecutionContext,
        next: CallHandler,
      ): Observable<unknown> {
        const request = context.switchToHttp().getRequest()
        const cacheKey = `${request.method}:${request.url}`

        const cached = this.cache.get(cacheKey)
        if (cached && cached.expires > Date.now()) {
          return of(cached.data)
        }

        return next.handle().pipe(
          tap((data) => {
            this.cache.set(cacheKey, {
              data,
              expires: Date.now() + this.ttlMs,
            })
          }),
        )
      }

      clearCache(): void {
        this.cache.clear()
      }
    }

    function createMockCallHandler<T>(response: T): CallHandler<T> {
      return {
        handle: () => of(response),
      }
    }

    function createMockErrorHandler(error: Error): CallHandler {
      return {
        handle: () => throwError(() => error),
      }
    }

    function createMockContext(
      requestData: Record<string, unknown> = {},
    ): ExecutionContext {
      const request = { method: 'GET', url: '/test', ...requestData }
      return {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      } as unknown as ExecutionContext
    }

    describe('Logging interceptor', () => {
      it('should log before and after', (done) => {
        const interceptor = new LoggingInterceptor()
        const context = createMockContext({ method: 'POST', url: '/users' })
        const next = createMockCallHandler({ id: 1 })

        interceptor.intercept(context, next).subscribe({
          complete: () => {
            const logs = interceptor.getLogs()
            expect(logs).toHaveLength(2)
            expect(logs[0]).toContain('Before: POST /users')
            expect(logs[1]).toMatch(/After: \d+ms/)
            done()
          },
        })
      })
    })

    describe('Transform interceptor', () => {
      it('should wrap response with timestamp', (done) => {
        const interceptor = new TransformInterceptor()
        const context = createMockContext()
        const next = createMockCallHandler({ name: 'test' })

        interceptor.intercept(context, next).subscribe({
          next: (result) => {
            expect(result).toHaveProperty('data', { name: 'test' })
            expect(result).toHaveProperty('timestamp')
            expect(typeof result.timestamp).toBe('string')
            done()
          },
        })
      })
    })

    describe('Error interceptor', () => {
      it('should transform 401 error', (done) => {
        const interceptor = new ErrorInterceptor()
        const context = createMockContext()
        const error = Object.assign(new Error('Unauthorized'), { status: 401 })
        const next = createMockErrorHandler(error)

        interceptor.intercept(context, next).subscribe({
          error: (err) => {
            expect(err).toBeInstanceOf(UnauthorizedException)
            expect(err.message).toContain('Custom:')
            done()
          },
        })
      })

      it('should transform 403 error', (done) => {
        const interceptor = new ErrorInterceptor()
        const context = createMockContext()
        const error = Object.assign(new Error('Forbidden'), { status: 403 })
        const next = createMockErrorHandler(error)

        interceptor.intercept(context, next).subscribe({
          error: (err) => {
            expect(err).toBeInstanceOf(ForbiddenException)
            done()
          },
        })
      })

      it('should pass through other errors', (done) => {
        const interceptor = new ErrorInterceptor()
        const context = createMockContext()
        const error = Object.assign(new Error('Server Error'), { status: 500 })
        const next = createMockErrorHandler(error)

        interceptor.intercept(context, next).subscribe({
          error: (err) => {
            expect(err.status).toBe(500)
            done()
          },
        })
      })
    })

    describe('Cache interceptor', () => {
      it('should cache response', (done) => {
        const interceptor = new CacheInterceptor(60000)
        const context = createMockContext({ method: 'GET', url: '/data' })
        let callCount = 0

        const createHandler = () => ({
          handle: () => {
            callCount++
            return of({ value: callCount })
          },
        })

        // First call
        interceptor.intercept(context, createHandler()).subscribe({
          next: (result1) => {
            expect(result1).toEqual({ value: 1 })

            // Second call (should be cached)
            interceptor.intercept(context, createHandler()).subscribe({
              next: (result2) => {
                expect(result2).toEqual({ value: 1 }) // Same cached value
                expect(callCount).toBe(1) // Handler only called once
                done()
              },
            })
          },
        })
      })

      it('should bypass cache for different URLs', (done) => {
        const interceptor = new CacheInterceptor(60000)
        let callCount = 0

        const createHandler = () => ({
          handle: () => {
            callCount++
            return of({ value: callCount })
          },
        })

        interceptor
          .intercept(
            createMockContext({ method: 'GET', url: '/data1' }),
            createHandler(),
          )
          .subscribe({
            next: () => {
              interceptor
                .intercept(
                  createMockContext({ method: 'GET', url: '/data2' }),
                  createHandler(),
                )
                .subscribe({
                  next: (result) => {
                    expect(result).toEqual({ value: 2 })
                    expect(callCount).toBe(2)
                    done()
                  },
                })
            },
          })
      })
    })
  })

  // ============================================================================
  // Metadata Reflection Tests
  // ============================================================================
  describe('Metadata Reflection', () => {
    const ROLES_KEY = 'roles'
    const PUBLIC_KEY = 'isPublic'

    /**
     * Roles decorator factory
     */
    function Roles(...roles: string[]) {
      return SetMetadata(ROLES_KEY, roles)
    }

    /**
     * Public decorator
     */
    function Public() {
      return SetMetadata(PUBLIC_KEY, true)
    }

    describe('SetMetadata decorator', () => {
      it('should set roles metadata', () => {
        @Roles('admin', 'user')
        class TestHandler {
          handle() {}
        }

        const reflector = new Reflector()
        const metadata = reflector.get<string[]>(ROLES_KEY, TestHandler)

        expect(metadata).toEqual(['admin', 'user'])
      })

      it('should set public metadata', () => {
        @Public()
        class PublicHandler {
          handle() {}
        }

        const reflector = new Reflector()
        const metadata = reflector.get<boolean>(PUBLIC_KEY, PublicHandler)

        expect(metadata).toBe(true)
      })

      it('should return undefined for missing metadata', () => {
        class NoMetadataHandler {
          handle() {}
        }

        const reflector = new Reflector()
        const metadata = reflector.get<string[]>(ROLES_KEY, NoMetadataHandler)

        expect(metadata).toBeUndefined()
      })
    })

    describe('Reflector utility', () => {
      it('should get all metadata from class', () => {
        @Roles('admin')
        @Public()
        class MultiMetadataHandler {
          handle() {}
        }

        const reflector = new Reflector()
        const roles = reflector.get<string[]>(ROLES_KEY, MultiMetadataHandler)
        const isPublic = reflector.get<boolean>(PUBLIC_KEY, MultiMetadataHandler)

        expect(roles).toEqual(['admin'])
        expect(isPublic).toBe(true)
      })

      it('should get metadata with getAllAndOverride', () => {
        @Roles('class-level')
        class TestController {
          @Roles('method-level')
          handle() {}
        }

        const reflector = new Reflector()

        // Method level should override class level
        const methodMetadata = reflector.getAllAndOverride<string[]>(ROLES_KEY, [
          TestController.prototype.handle,
          TestController,
        ])

        expect(methodMetadata).toEqual(['method-level'])
      })

      it('should merge metadata with getAllAndMerge', () => {
        @Roles('class-role')
        class TestController {
          @Roles('method-role')
          handle() {}
        }

        const reflector = new Reflector()

        // Should merge both levels
        const mergedMetadata = reflector.getAllAndMerge<string[]>(ROLES_KEY, [
          TestController.prototype.handle,
          TestController,
        ])

        expect(mergedMetadata).toContain('method-role')
        expect(mergedMetadata).toContain('class-role')
      })
    })
  })

  // ============================================================================
  // Composition Tests
  // ============================================================================
  describe('Guard, Pipe, Interceptor Composition', () => {
    /**
     * Simulates a full request lifecycle
     */
    interface RequestPipeline {
      guard: (context: ExecutionContext) => boolean | Promise<boolean>
      pipe: (value: unknown) => unknown | Promise<unknown>
      interceptor: (
        context: ExecutionContext,
        handler: () => Promise<unknown>,
      ) => Promise<unknown>
    }

    function createPipeline(): RequestPipeline {
      return {
        guard: (context) => {
          const request = context.switchToHttp().getRequest()
          return !!request.user
        },
        pipe: (value) => {
          if (typeof value === 'string') {
            return value.trim().toLowerCase()
          }
          return value
        },
        interceptor: async (context, handler) => {
          const start = Date.now()
          const result = await handler()
          const elapsed = Date.now() - start
          return {
            data: result,
            meta: { elapsed },
          }
        },
      }
    }

    it('should execute full pipeline for authenticated request', async () => {
      const pipeline = createPipeline()

      const context = {
        switchToHttp: () => ({
          getRequest: () => ({ user: { id: '123' } }),
        }),
      } as ExecutionContext

      // Step 1: Guard
      const canActivate = pipeline.guard(context)
      expect(canActivate).toBe(true)

      // Step 2: Pipe
      const transformedInput = pipeline.pipe('  HELLO WORLD  ')
      expect(transformedInput).toBe('hello world')

      // Step 3: Interceptor
      const result = await pipeline.interceptor(context, async () => ({
        message: 'success',
      }))

      expect(result).toHaveProperty('data', { message: 'success' })
      expect(result).toHaveProperty('meta.elapsed')
    })

    it('should reject unauthenticated request at guard', () => {
      const pipeline = createPipeline()

      const context = {
        switchToHttp: () => ({
          getRequest: () => ({ user: null }),
        }),
      } as ExecutionContext

      const canActivate = pipeline.guard(context)
      expect(canActivate).toBe(false)
    })
  })
})
