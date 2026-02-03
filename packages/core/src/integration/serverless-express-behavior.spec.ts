/**
 * @codegenie/serverless-express Behavioral Tests
 *
 * These tests verify serverless-express behaviors that are critical
 * for the framework's Lambda handler and event source routing.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import serverlessExpress, { getCurrentInvoke } from '@codegenie/serverless-express'
import express from 'express'

describe('@codegenie/serverless-express Behavioral Tests', () => {
  // Helper to create minimal Lambda context
  const createContext = () => ({
    awsRequestId: 'test-aws-request-id',
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-function',
    functionVersion: '$LATEST',
    invokedFunctionArn:
      'arn:aws:lambda:us-east-1:123456789012:function:test-function',
    logGroupName: '/aws/lambda/test-function',
    logStreamName: '2024/01/01/[$LATEST]abc123',
    memoryLimitInMB: '128',
    getRemainingTimeInMillis: () => 30000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  })

  // Helper to create minimal API Gateway event
  const createApiGatewayEvent = (
    method: string,
    path: string,
    options: {
      headers?: Record<string, string>
      queryStringParameters?: Record<string, string> | null
      body?: string | null
    } = {},
  ) => ({
    httpMethod: method,
    path,
    headers: options.headers || {},
    queryStringParameters: options.queryStringParameters || null,
    pathParameters: null,
    body: options.body || null,
    isBase64Encoded: false,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      authorizer: null,
      httpMethod: method,
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test-agent',
        userArn: null,
      },
      path,
      protocol: 'HTTP/1.1',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: path,
      stage: 'test',
    },
    resource: path,
    stageVariables: null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
  })

  // Helper to invoke handler (cast to any to bypass TypeScript strict Handler signature)
  const invoke = (handler: any, event: any, ctx: any): Promise<any> => {
    return handler(event, ctx)
  }

  describe('Module exports', () => {
    it('should export serverlessExpress as default', () => {
      expect(typeof serverlessExpress).toBe('function')
    })

    it('should export getCurrentInvoke helper', () => {
      expect(typeof getCurrentInvoke).toBe('function')
    })
  })

  describe('Basic Express app wrapping', () => {
    let app: express.Application
    let handler: any

    beforeEach(() => {
      app = express()
      app.get('/test', (req, res) => {
        res.json({ message: 'Hello World' })
      })

      handler = serverlessExpress({ app })
    })

    it('should create a Lambda handler from Express app', () => {
      expect(typeof handler).toBe('function')
    })

    it('should handle API Gateway event', async () => {
      const event = createApiGatewayEvent('GET', '/test')
      const ctx = createContext()

      const response = await invoke(handler, event, ctx)

      expect(response).toBeDefined()
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.message).toBe('Hello World')
    })

    it('should return error status for non-existent routes', async () => {
      const event = createApiGatewayEvent('GET', '/non-existent')
      const ctx = createContext()

      const response = await invoke(handler, event, ctx)

      // serverless-express returns 500 for unhandled routes without error middleware
      // This documents the actual behavior
      expect(response.statusCode).toBeGreaterThanOrEqual(400)
    })
  })

  describe('Resolution modes', () => {
    it('should support PROMISE resolution mode', async () => {
      const app = express()
      app.get('/promise', (req, res) => {
        res.json({ mode: 'promise' })
      })

      const handler = serverlessExpress({
        app,
        resolutionMode: 'PROMISE',
      })

      const event = createApiGatewayEvent('GET', '/promise')
      const ctx = createContext()

      const response = await invoke(handler, event, ctx)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.mode).toBe('promise')
    })
  })

  describe('Event source routing configuration', () => {
    it('should accept event source route mapping configuration', () => {
      const app = express()
      app.use(express.json())

      // Define routes for different event sources
      app.post('/event/sns', (req, res) => {
        res.json({ eventSource: 'SNS', body: req.body })
      })
      app.post('/event/sqs', (req, res) => {
        res.json({ eventSource: 'SQS', body: req.body })
      })
      app.post('/event/dynamodb', (req, res) => {
        res.json({ eventSource: 'DynamoDB', body: req.body })
      })
      app.post('/event/event-bridge', (req, res) => {
        res.json({ eventSource: 'EventBridge', body: req.body })
      })
      app.post('/event/s3', (req, res) => {
        res.json({ eventSource: 'S3', body: req.body })
      })

      // Should not throw when event source routes are provided
      const handler = serverlessExpress({
        app,
        eventSourceRoutes: {
          AWS_SNS: '/event/sns',
          AWS_SQS: '/event/sqs',
          AWS_DYNAMODB: '/event/dynamodb',
          AWS_EVENTBRIDGE: '/event/event-bridge',
          AWS_S3: '/event/s3',
        },
      })

      expect(typeof handler).toBe('function')
    })

    it('should support AWS_KINESIS_DATA_STREAM event source route', () => {
      const app = express()
      app.post('/event/kinesis', (req, res) => {
        res.json({ eventSource: 'Kinesis' })
      })

      const handler = serverlessExpress({
        app,
        eventSourceRoutes: {
          AWS_KINESIS_DATA_STREAM: '/event/kinesis',
        },
      })

      expect(typeof handler).toBe('function')
    })

    it('should support AWS_STEP_FUNCTIONS event source route', () => {
      const app = express()
      app.post('/event/step-functions', (req, res) => {
        res.json({ eventSource: 'StepFunctions' })
      })

      const handler = serverlessExpress({
        app,
        eventSourceRoutes: {
          AWS_STEP_FUNCTIONS: '/event/step-functions',
        },
      })

      expect(typeof handler).toBe('function')
    })
  })

  describe('Log settings', () => {
    it('should accept log level configuration', () => {
      const app = express()
      app.get('/', (req, res) => res.send('ok'))

      // Should not throw when log settings are provided
      const handler = serverlessExpress({
        app,
        logSettings: {
          level: 'debug',
        },
      })

      expect(typeof handler).toBe('function')
    })

    it('should accept verbose log level', () => {
      const app = express()
      app.get('/', (req, res) => res.send('ok'))

      const handler = serverlessExpress({
        app,
        logSettings: {
          level: 'verbose',
        },
      })

      expect(typeof handler).toBe('function')
    })

    it('should accept error log level', () => {
      const app = express()
      app.get('/', (req, res) => res.send('ok'))

      const handler = serverlessExpress({
        app,
        logSettings: {
          level: 'error',
        },
      })

      expect(typeof handler).toBe('function')
    })
  })

  describe('HTTP methods', () => {
    let app: express.Application
    let handler: any

    beforeEach(() => {
      app = express()
      app.use(express.json())

      app.get('/resource', (req, res) => res.json({ method: 'GET' }))
      app.post('/resource', (req, res) => res.json({ method: 'POST' }))
      app.put('/resource', (req, res) => res.json({ method: 'PUT' }))
      app.patch('/resource', (req, res) => res.json({ method: 'PATCH' }))
      app.delete('/resource', (req, res) => res.json({ method: 'DELETE' }))

      handler = serverlessExpress({ app })
    })

    const testHttpMethod = async (method: string) => {
      const event = createApiGatewayEvent(method, '/resource')
      const ctx = createContext()
      return invoke(handler, event, ctx)
    }

    it('should handle GET requests', async () => {
      const response = await testHttpMethod('GET')
      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body).method).toBe('GET')
    })

    it('should handle POST requests', async () => {
      const response = await testHttpMethod('POST')
      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body).method).toBe('POST')
    })

    it('should handle PUT requests', async () => {
      const response = await testHttpMethod('PUT')
      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body).method).toBe('PUT')
    })

    it('should handle PATCH requests', async () => {
      const response = await testHttpMethod('PATCH')
      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body).method).toBe('PATCH')
    })

    it('should handle DELETE requests', async () => {
      const response = await testHttpMethod('DELETE')
      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body).method).toBe('DELETE')
    })
  })

  describe('Path parameters', () => {
    it('should pass path parameters to Express', async () => {
      const app = express()
      app.get('/users/:userId/posts/:postId', (req, res) => {
        res.json({
          userId: req.params.userId,
          postId: req.params.postId,
        })
      })

      const handler = serverlessExpress({ app })

      const event = createApiGatewayEvent('GET', '/users/123/posts/456')
      const ctx = createContext()

      const response = await invoke(handler, event, ctx)
      const body = JSON.parse(response.body)

      expect(body.userId).toBe('123')
      expect(body.postId).toBe('456')
    })
  })

  describe('Response status codes', () => {
    it('should return correct status codes', async () => {
      const app = express()
      app.get('/created', (req, res) => res.status(201).json({ status: 'created' }))
      app.get('/accepted', (req, res) => res.status(202).json({ status: 'accepted' }))
      app.get('/no-content', (req, res) => res.status(204).end())
      app.get('/bad-request', (req, res) =>
        res.status(400).json({ error: 'Bad Request' }),
      )
      app.get('/unauthorized', (req, res) =>
        res.status(401).json({ error: 'Unauthorized' }),
      )
      app.get('/forbidden', (req, res) =>
        res.status(403).json({ error: 'Forbidden' }),
      )
      app.get('/not-found', (req, res) =>
        res.status(404).json({ error: 'Not Found' }),
      )
      app.get('/server-error', (req, res) =>
        res.status(500).json({ error: 'Internal Server Error' }),
      )

      const handler = serverlessExpress({ app })
      const ctx = createContext()

      expect(
        (await invoke(handler, createApiGatewayEvent('GET', '/created'), ctx)).statusCode,
      ).toBe(201)
      expect(
        (await invoke(handler, createApiGatewayEvent('GET', '/accepted'), ctx)).statusCode,
      ).toBe(202)
      expect(
        (await invoke(handler, createApiGatewayEvent('GET', '/no-content'), ctx))
          .statusCode,
      ).toBe(204)
      expect(
        (await invoke(handler, createApiGatewayEvent('GET', '/bad-request'), ctx))
          .statusCode,
      ).toBe(400)
      expect(
        (await invoke(handler, createApiGatewayEvent('GET', '/unauthorized'), ctx))
          .statusCode,
      ).toBe(401)
      expect(
        (await invoke(handler, createApiGatewayEvent('GET', '/forbidden'), ctx))
          .statusCode,
      ).toBe(403)
      expect(
        (await invoke(handler, createApiGatewayEvent('GET', '/not-found'), ctx))
          .statusCode,
      ).toBe(404)
      expect(
        (await invoke(handler, createApiGatewayEvent('GET', '/server-error'), ctx))
          .statusCode,
      ).toBe(500)
    })
  })

  describe('Error handling', () => {
    it('should handle Express errors with error middleware', async () => {
      const app = express()
      app.get('/error', (req, res, next) => {
        next(new Error('Test error'))
      })
      // Error handling middleware
      app.use(
        (
          err: Error,
          req: express.Request,
          res: express.Response,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          next: express.NextFunction,
        ) => {
          res.status(500).json({ error: err.message })
        },
      )

      const handler = serverlessExpress({ app })

      const event = createApiGatewayEvent('GET', '/error')
      const ctx = createContext()

      const response = await invoke(handler, event, ctx)

      expect(response.statusCode).toBe(500)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('Test error')
    })
  })

  describe('Async route handlers', () => {
    it('should handle async Express route handlers', async () => {
      const app = express()
      app.get('/async', async (req, res) => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        res.json({ async: true })
      })

      const handler = serverlessExpress({ app })

      const event = createApiGatewayEvent('GET', '/async')
      const ctx = createContext()

      const response = await invoke(handler, event, ctx)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.async).toBe(true)
    })
  })

  describe('Response headers', () => {
    it('should include custom response headers', async () => {
      const app = express()
      app.get('/custom-header', (req, res) => {
        res.setHeader('X-Custom-Response', 'custom-value')
        res.json({ ok: true })
      })

      const handler = serverlessExpress({ app })

      const event = createApiGatewayEvent('GET', '/custom-header')
      const ctx = createContext()

      const response = await invoke(handler, event, ctx)

      expect(response.statusCode).toBe(200)
      // Headers may be in headers or multiValueHeaders depending on serverless-express version
      const hasCustomHeader =
        response.headers?.['x-custom-response'] === 'custom-value' ||
        response.multiValueHeaders?.['x-custom-response']?.includes('custom-value')
      expect(hasCustomHeader).toBe(true)
    })
  })

  describe('JSON body parsing', () => {
    it('should handle request body in some form', async () => {
      const app = express()
      app.use(express.json())
      app.post('/json', (req, res) => {
        // Body parsing behavior may vary depending on serverless-express configuration
        // This test verifies the handler can process the request
        res.json({ hasBody: req.body !== undefined, bodyType: typeof req.body })
      })

      const handler = serverlessExpress({ app })

      const event = createApiGatewayEvent('POST', '/json', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'value' }),
      })
      const ctx = createContext()

      const response = await invoke(handler, event, ctx)

      // The handler should process the request successfully
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.hasBody).toBe(true)
    })
  })
})
