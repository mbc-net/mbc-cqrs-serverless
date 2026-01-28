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

/**
 * Extract user context from JWT claims and request headers.
 *
 * Tenant code determination:
 * 1. If `custom:tenant` exists in JWT claims, use it (user bound to specific tenant)
 * 2. Otherwise, use `x-tenant-code` header (for cross-tenant operations)
 *
 * Note: Security validation for header-based tenant override is handled by RolesGuard,
 * not by this function. This allows for flexible security policies at the application level.
 */
export function getUserContext(ctx: IInvoke | ExecutionContext): UserContext {
  if ('getHandler' in ctx) {
    ctx = extractInvokeContext(ctx)
  }
  const claims = getAuthorizerClaims(ctx)

  const userId = claims.sub

  // Parse roles
  const roles = (
    JSON.parse(claims['custom:roles'] || '[]') as CustomRole[]
  ).map((role) => ({ ...role, tenant: (role.tenant || '').toLowerCase() }))

  // Determine tenant code
  // 1. Cognito custom:tenant attribute takes priority
  // 2. Otherwise, use header value (security check delegated to RolesGuard)
  const tenantCode =
    claims['custom:tenant'] || (ctx?.event?.headers || {})[HEADER_TENANT_CODE]

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
