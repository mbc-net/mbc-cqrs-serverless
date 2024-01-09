import { getCurrentInvoke } from '@codegenie/serverless-express'

export interface CustomRole {
  tenant: string // tenant's code
  role: string // tenant' role
}

export interface JwtClaims {
  sub: string
  iss: string
  'cognito:groups'?: string[]
  'cognito:username': string
  origin_jti?: string
  aud: string
  event_id: string
  token_use: string
  auth_time: number
  name: string
  'custom:tenant'?: string // tenant code
  'custom:roles'?: string
  exp: number
  email: string
  iat: number
  jti: string
}

export class UserContext {
  userId: string
  tenantRole: string
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

  const userId = claims.sub
  const tenantCode =
    claims['custom:tenant'] || (event?.headers || {})['x-tenant-code']
  // find tenantRole
  const roles = (
    JSON.parse(claims['custom:roles'] || '[]') as CustomRole[]
  ).map((role) => ({ ...role, tenant: (role.tenant || '').toLowerCase() }))
  let tenantRole = ''
  for (const { tenant, role } of roles) {
    if (tenant === '' || tenant === tenantCode) {
      tenantRole = role
      if (tenant !== '') {
        break
      }
    }
  }

  return {
    userId,
    tenantRole,
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
