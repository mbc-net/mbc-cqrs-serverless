import { getCurrentInvoke } from '@codegenie/serverless-express'

import { Role } from '../constants'

export interface JwtClaims {
  sub: string
  iss: string
  'cognito:username': string
  origin_jti?: string
  aud: string
  event_id: string
  token_use: string
  auth_time: number
  name: string
  'custom:tenantCode'?: string
  'custom:superRole'?: 'super_admin' | 'tenant_user'
  exp: number
  email: string
  iat: number
  jti: string
}

export class UserContext {
  userId: string
  isSuperAdmin: boolean
  role?: string
  tenantCode: string

  constructor(partial: Partial<UserContext>) {
    Object.assign(this, partial)
  }
}

export const getUserContext = (event?: any): UserContext => {
  if (!event) {
    event = getCurrentInvoke().event
  }
  const claims = getAuthorizerClaims(event)

  const tenantCode = claims['custom:tenantCode'] || event?.headers?.tenant
  const userId = claims.sub
  const role = event?.requestContext?.authorizer?.role
  const isSuperAdmin = claims['custom:super_role'] === Role.SUPER_ADMIN

  return {
    userId,
    role,
    isSuperAdmin,
    tenantCode,
  }
}

export const setAuthorizerContext = (
  event: any,
  key: string,
  value: string | boolean,
) => {
  if (key === 'jwt') {
    return
  }
  event.requestContext.authorizer[key] = value
}

export const setAuthorizerContextObject = (event: any, context: object) => {
  for (const key in context) {
    if (Object.prototype.hasOwnProperty.call(context, key)) {
      const value = context[key]
      setAuthorizerContext(event, key, value)
    }
  }
}

export const getAuthorizerClaims = (event: any): JwtClaims => {
  return event?.requestContext?.authorizer?.jwt?.claims || {}
  // {
  //   "sub": "92ca4f68-9ac6-4080-9ae2-2f02a86206a4",
  //   "iss": "http://localhost:9229/local_2G7noHgW",
  //   "cognito:username": "admin2",
  //   "origin_jti": "af065044-5ddd-46f9-b0bb-94941ad80a11",
  //   "aud": "dnk8y7ii3wled35p3lw0l2cd7",
  //   "event_id": "4dbf2af0-6bfc-4500-a3b1-2a07293accb4",
  //   "token_use": "id",
  //   "auth_time": 1699930911,
  //   "name": "admin2",
  //   "custom:tenantCode": "1801",
  //   "custom:super_role": "super_admin",
  //   "exp": 1700017311,
  //   "email": "admin@test.com",
  //   "iat": 1699930911,
  //   "jti": "ed9c5048-a6ea-4c67-ba60-4d9c3bcbafaa"
  // }
}
