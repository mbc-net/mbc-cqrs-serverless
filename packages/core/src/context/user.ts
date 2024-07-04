import { ExecutionContext } from '@nestjs/common'

import { HEADER_TENANT_CODE } from '../constants'
import { extractInvokeContext, getAuthorizerClaims, IInvoke } from './invoke'

export interface CustomRole {
  tenant: string // tenant's code
  role: string // tenant' role
}

export class UserContext {
  userId: string
  tenantRole: string
  tenantCode: string

  constructor(partial: Partial<UserContext>) {
    Object.assign(this, partial)
  }
}

export function getUserContext(ctx: IInvoke | ExecutionContext): UserContext {
  if ('getHandler' in ctx) {
    ctx = extractInvokeContext(ctx)
  }
  const claims = getAuthorizerClaims(ctx)

  const userId = claims.sub
  const tenantCode =
    claims['custom:tenant'] || (ctx?.event?.headers || {})[HEADER_TENANT_CODE]
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
