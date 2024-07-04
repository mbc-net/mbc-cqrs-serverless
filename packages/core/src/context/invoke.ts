import { getCurrentInvoke } from '@codegenie/serverless-express'
import { ExecutionContext } from '@nestjs/common'
import { Request } from 'express'
import { jwtDecode } from 'jwt-decode'

import { IS_LAMBDA_RUNNING } from '../helpers'

export interface JwtClaims {
  sub: string
  iss: string
  username?: string
  'cognito:groups'?: string[]
  'cognito:username': string
  origin_jti?: string
  client_id?: string
  scope?: string
  aud: string
  event_id: string
  token_use: string
  auth_time: number
  name: string
  'custom:tenant'?: string // tenant code
  'custom:roles'?: string
  exp: number
  email: string
  email_verified?: boolean
  iat: number
  jti: string
}

export interface IInvokeEvent {
  version?: string
  routeKey?: string
  rawPath?: string
  rawQueryString?: string
  headers?: Record<string, string>
  requestContext?: {
    accountId?: string
    apiId?: string
    domainName?: string
    domainPrefix?: string
    http?: {
      method?: string
      path?: string
      protocol?: string
      sourceIp?: string
      userAgent?: string
    }
    requestId?: string
    stage?: string
    time?: string
    timeEpoch?: number
    authorizer?: {
      jwt?: {
        claims?: JwtClaims
        scopes?: string[]
      }
    }
  }
  isBase64Encoded?: boolean
}

export interface IInvokeContext {
  functionName?: string
  functionVersion?: string
  invokedFunctionArn?: string
  memoryLimitInMB?: string
  awsRequestId?: string
  logGroupName?: string
  logStreamName?: string
  identity?: {
    cognitoIdentityId?: string
    cognitoIdentityPoolId?: string
  }
}

export interface IInvoke {
  event?: IInvokeEvent
  context?: IInvokeContext
}

export function extractInvokeContext(ctx?: ExecutionContext): IInvoke {
  if (IS_LAMBDA_RUNNING) {
    return getCurrentInvoke()
  }
  if (!ctx) {
    return {}
  }
  const request = ctx.switchToHttp().getRequest<Request>()
  const headers = request.headers as Record<string, string>
  let authorizer: object | undefined = undefined
  const authToken = request.get('authorization')
  if (authToken) {
    const claims = jwtDecode<JwtClaims>(authToken)
    authorizer = {
      jwt: {
        claims,
        scopes: claims?.scope?.split(','),
      },
    }
  }
  return {
    event: {
      routeKey: `${request.method} ${request.path}`,
      rawPath: request.originalUrl,
      headers,
      requestContext: {
        domainName: request.hostname,
        http: {
          method: request.method,
          path: request.path,
          protocol: request.protocol,
          sourceIp: request.ip,
          userAgent: request.get('user-agent'),
        },
        requestId: request.get('x-request-id'),
        authorizer,
      },
    },
    context: {
      awsRequestId:
        request.get('x-amzn-trace-id') || request.get('x-request-id'),
    },
  }
}

export const getAuthorizerClaims = (ctx: IInvoke): JwtClaims => {
  return ctx?.event?.requestContext?.authorizer?.jwt?.claims
  // {
  //   "sub": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
  //   "iss": "http://localhost:9229/local_2G7noHgW",
  //   "cognito:groups": ["admins"],
  //   "cognito:username": "admin2",
  //   "origin_jti": "af065044-5ddd-46f9-b0bb-94941ad80a11",
  //   "aud": "dnk8y7ii3wled35p3lw0l2cd7",
  //   "event_id": "4dbf2af0-6bfc-4500-a3b1-2a07293accb4",
  //   "token_use": "id",
  //   "auth_time": 1699930911,
  //   "name": "admin2",
  //   "custom:tenant": "1801",
  //   "custom:roles": "[{\"role\":\"system_admin\"}]",
  //   "exp": 1700017311,
  //   "email": "admin@test.com",
  //   "iat": 1699930911,
  //   "jti": "ed9c5048-a6ea-4c67-ba60-4d9c3bcbafaa"
  // }
}
