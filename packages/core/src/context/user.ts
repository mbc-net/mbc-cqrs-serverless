import { ExecutionContext } from '@nestjs/common'

import { HEADER_TENANT_CODE, ROLE_SYSTEM_ADMIN } from '../constants'
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

  // Parse roles first (needed for system admin check)
  const roles = (
    JSON.parse(claims['custom:roles'] || '[]') as CustomRole[]
  ).map((role) => ({ ...role, tenant: (role.tenant || '').toLowerCase() }))

  // Check if user is system admin (tenant-independent check)
  const isSystemAdmin = roles.some(
    (r) => r.role === ROLE_SYSTEM_ADMIN && r.tenant === '',
  )

  // Determine tenant code
  // 1. Cognito custom:tenant attribute takes priority
  // 2. Only system admin can override tenant code via header
  // 3. Otherwise, tenant code is empty (will be rejected by RolesGuard)
  const headerTenantCode = (ctx?.event?.headers || {})[HEADER_TENANT_CODE]
  let tenantCode: string

  if (claims['custom:tenant']) {
    tenantCode = claims['custom:tenant']
  } else if (isSystemAdmin && headerTenantCode) {
    tenantCode = headerTenantCode
  } else {
    tenantCode = ''
  }

  // Find tenantRole
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
