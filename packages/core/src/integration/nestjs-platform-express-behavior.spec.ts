/**
 * NestJS Platform Express Behavioral Tests
 *
 * These tests verify that @nestjs/platform-express behaves as expected.
 * When the library's behavior changes in a new version, these tests will fail.
 *
 * This platform adapter is used to run NestJS applications with Express
 * as the underlying HTTP framework, particularly in AWS Lambda with
 * serverless-express.
 */

import 'reflect-metadata'

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  Module,
  Injectable,
  NestMiddleware,
  MiddlewareConsumer,
  NestModule,
  UseGuards,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { Test, TestingModule } from '@nestjs/testing'
import { Request, Response, NextFunction } from 'express'
import request from 'supertest'

describe('NestJS Platform Express Behavioral Tests', () => {
  describe('Module exports', () => {
    it('should export NestExpressApplication type', () => {
      // This is a type check - if it compiles, the type is exported
      const typeCheck: NestExpressApplication | null = null
      expect(typeCheck).toBeNull()
    })
  })

  describe('Basic Express adapter functionality', () => {
    @Controller('test')
    class TestController {
      @Get()
      getHello(): string {
        return 'Hello World'
      }

      @Get(':id')
      getById(@Param('id') id: string): { id: string } {
        return { id }
      }

      @Post()
      @HttpCode(HttpStatus.CREATED)
      create(@Body() body: { name: string }): { created: boolean; name: string } {
        return { created: true, name: body.name }
      }
    }

    @Module({
      controllers: [TestController],
    })
    class TestModule {}

    let app: NestExpressApplication
    let module: TestingModule

    beforeAll(async () => {
      module = await Test.createTestingModule({
        imports: [TestModule],
      }).compile()

      app = module.createNestApplication<NestExpressApplication>()
      await app.init()
    })

    afterAll(async () => {
      await app.close()
    })

    it('should handle GET request', async () => {
      const response = await request(app.getHttpServer())
        .get('/test')
        .expect(200)

      expect(response.text).toBe('Hello World')
    })

    it('should handle route parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/test/123')
        .expect(200)

      expect(response.body).toEqual({ id: '123' })
    })

    it('should handle POST with body', async () => {
      const response = await request(app.getHttpServer())
        .post('/test')
        .send({ name: 'Test Item' })
        .expect(201)

      expect(response.body).toEqual({ created: true, name: 'Test Item' })
    })
  })

  describe('Query parameters handling', () => {
    @Controller('query')
    class QueryController {
      @Get()
      search(
        @Query('q') query: string,
        @Query('limit') limit?: string,
      ): { query: string; limit?: string } {
        return { query, limit }
      }

      @Get('multiple')
      multipleParams(
        @Query() allQuery: Record<string, string>,
      ): Record<string, string> {
        return allQuery
      }
    }

    @Module({
      controllers: [QueryController],
    })
    class QueryModule {}

    let app: NestExpressApplication

    beforeAll(async () => {
      const module = await Test.createTestingModule({
        imports: [QueryModule],
      }).compile()

      app = module.createNestApplication<NestExpressApplication>()
      await app.init()
    })

    afterAll(async () => {
      await app.close()
    })

    it('should parse query parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/query?q=search-term&limit=10')
        .expect(200)

      expect(response.body).toEqual({ query: 'search-term', limit: '10' })
    })

    it('should handle missing optional parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/query?q=search-only')
        .expect(200)

      expect(response.body.query).toBe('search-only')
    })

    it('should parse multiple query parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/query/multiple?a=1&b=2&c=3')
        .expect(200)

      expect(response.body).toEqual({ a: '1', b: '2', c: '3' })
    })
  })

  describe('Headers handling', () => {
    @Controller('headers')
    class HeadersController {
      @Get()
      getHeaders(
        @Headers('x-custom-header') customHeader: string,
        @Headers('authorization') auth?: string,
      ): { custom: string; hasAuth: boolean } {
        return { custom: customHeader, hasAuth: !!auth }
      }

      @Get('all')
      getAllHeaders(@Headers() headers: Record<string, string>): {
        hasHost: boolean
      } {
        return { hasHost: !!headers.host }
      }
    }

    @Module({
      controllers: [HeadersController],
    })
    class HeadersModule {}

    let app: NestExpressApplication

    beforeAll(async () => {
      const module = await Test.createTestingModule({
        imports: [HeadersModule],
      }).compile()

      app = module.createNestApplication<NestExpressApplication>()
      await app.init()
    })

    afterAll(async () => {
      await app.close()
    })

    it('should extract custom headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/headers')
        .set('X-Custom-Header', 'custom-value')
        .expect(200)

      expect(response.body.custom).toBe('custom-value')
    })

    it('should detect authorization header', async () => {
      const response = await request(app.getHttpServer())
        .get('/headers')
        .set('X-Custom-Header', 'value')
        .set('Authorization', 'Bearer token')
        .expect(200)

      expect(response.body.hasAuth).toBe(true)
    })

    it('should access all headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/headers/all')
        .expect(200)

      expect(response.body.hasHost).toBe(true)
    })
  })

  describe('Middleware integration', () => {
    @Injectable()
    class LoggingMiddleware implements NestMiddleware {
      use(req: Request, res: Response, next: NextFunction): void {
        req['logged'] = true
        next()
      }
    }

    @Controller('middleware')
    class MiddlewareController {
      @Get()
      test(): { success: boolean } {
        return { success: true }
      }
    }

    @Module({
      controllers: [MiddlewareController],
    })
    class MiddlewareModule implements NestModule {
      configure(consumer: MiddlewareConsumer): void {
        consumer.apply(LoggingMiddleware).forRoutes('middleware')
      }
    }

    let app: NestExpressApplication

    beforeAll(async () => {
      const module = await Test.createTestingModule({
        imports: [MiddlewareModule],
      }).compile()

      app = module.createNestApplication<NestExpressApplication>()
      await app.init()
    })

    afterAll(async () => {
      await app.close()
    })

    it('should execute middleware', async () => {
      const response = await request(app.getHttpServer())
        .get('/middleware')
        .expect(200)

      expect(response.body).toEqual({ success: true })
    })
  })

  describe('Guard integration', () => {
    @Injectable()
    class AuthGuard implements CanActivate {
      canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>()
        return request.headers.authorization === 'valid-token'
      }
    }

    @Controller('guarded')
    @UseGuards(AuthGuard)
    class GuardedController {
      @Get()
      protectedRoute(): { access: string } {
        return { access: 'granted' }
      }
    }

    @Module({
      controllers: [GuardedController],
      providers: [AuthGuard],
    })
    class GuardedModule {}

    let app: NestExpressApplication

    beforeAll(async () => {
      const module = await Test.createTestingModule({
        imports: [GuardedModule],
      }).compile()

      app = module.createNestApplication<NestExpressApplication>()
      await app.init()
    })

    afterAll(async () => {
      await app.close()
    })

    it('should allow access with valid authorization', async () => {
      const response = await request(app.getHttpServer())
        .get('/guarded')
        .set('Authorization', 'valid-token')
        .expect(200)

      expect(response.body).toEqual({ access: 'granted' })
    })

    it('should deny access without valid authorization', async () => {
      await request(app.getHttpServer())
        .get('/guarded')
        .set('Authorization', 'invalid-token')
        .expect(403)
    })
  })

  describe('Error handling', () => {
    @Controller('error')
    class ErrorController {
      @Get('throw')
      throwError(): void {
        throw new Error('Test error')
      }

      @Get('not-found')
      notFound(): void {
        const error: any = new Error('Not Found')
        error.status = 404
        throw error
      }
    }

    @Module({
      controllers: [ErrorController],
    })
    class ErrorModule {}

    let app: NestExpressApplication

    beforeAll(async () => {
      const module = await Test.createTestingModule({
        imports: [ErrorModule],
      }).compile()

      app = module.createNestApplication<NestExpressApplication>()
      await app.init()
    })

    afterAll(async () => {
      await app.close()
    })

    it('should handle thrown errors', async () => {
      await request(app.getHttpServer()).get('/error/throw').expect(500)
    })
  })

  describe('JSON body parsing', () => {
    @Controller('json')
    class JsonController {
      @Post()
      handleJson(@Body() body: any): any {
        return body
      }

      @Post('nested')
      handleNestedJson(
        @Body() body: { data: { nested: { value: string } } },
      ): string {
        return body.data.nested.value
      }
    }

    @Module({
      controllers: [JsonController],
    })
    class JsonModule {}

    let app: NestExpressApplication

    beforeAll(async () => {
      const module = await Test.createTestingModule({
        imports: [JsonModule],
      }).compile()

      app = module.createNestApplication<NestExpressApplication>()
      await app.init()
    })

    afterAll(async () => {
      await app.close()
    })

    it('should parse JSON body', async () => {
      const testData = { key: 'value', number: 42 }

      const response = await request(app.getHttpServer())
        .post('/json')
        .send(testData)
        .expect(201)

      expect(response.body).toEqual(testData)
    })

    it('should handle nested JSON', async () => {
      const nestedData = {
        data: {
          nested: {
            value: 'deep-value',
          },
        },
      }

      const response = await request(app.getHttpServer())
        .post('/json/nested')
        .send(nestedData)
        .expect(201)

      expect(response.text).toBe('deep-value')
    })

    it('should handle array in body', async () => {
      const arrayData = [1, 2, 3, 4, 5]

      const response = await request(app.getHttpServer())
        .post('/json')
        .send(arrayData)
        .expect(201)

      expect(response.body).toEqual(arrayData)
    })
  })

  describe('Response customization', () => {
    @Controller('response')
    class ResponseController {
      @Get('status')
      @HttpCode(202)
      customStatus(): { message: string } {
        return { message: 'Accepted' }
      }
    }

    @Module({
      controllers: [ResponseController],
    })
    class ResponseModule {}

    let app: NestExpressApplication

    beforeAll(async () => {
      const module = await Test.createTestingModule({
        imports: [ResponseModule],
      }).compile()

      app = module.createNestApplication<NestExpressApplication>()
      await app.init()
    })

    afterAll(async () => {
      await app.close()
    })

    it('should return custom status code', async () => {
      await request(app.getHttpServer()).get('/response/status').expect(202)
    })
  })

  describe('Express-specific features', () => {
    let app: NestExpressApplication

    beforeAll(async () => {
      @Controller('express')
      class ExpressController {
        @Get()
        test(): string {
          return 'Express works'
        }
      }

      @Module({
        controllers: [ExpressController],
      })
      class ExpressModule {}

      const module = await Test.createTestingModule({
        imports: [ExpressModule],
      }).compile()

      app = module.createNestApplication<NestExpressApplication>()
      await app.init()
    })

    afterAll(async () => {
      await app.close()
    })

    it('should return Express HTTP server', () => {
      const server = app.getHttpServer()
      expect(server).toBeDefined()
      expect(typeof server.listen).toBe('function')
    })

    it('should have getHttpAdapter method', () => {
      const adapter = app.getHttpAdapter()
      expect(adapter).toBeDefined()
    })
  })
})
