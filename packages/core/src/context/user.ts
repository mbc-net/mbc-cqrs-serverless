import { ExecutionContext } from '@nestjs/common'

import { HEADER_TENANT_CODE } from '../constants'
import { extractInvokeContext, getAuthorizerClaims, IInvoke } from './invoke'
import { parseCustomRolesJson, resolveTenantRoles } from './role-resolver'

export interface CustomRole {
  tenant: string // tenant's code
  role: string // tenant' role
}

export class UserContext {
  userId: string
  /** First matching role from custom:roles only — unchanged for backward compatibility. */
  tenantRole: string
  tenantCode: string
  /**
   * Union of custom:roles and custom:groups for authorization (RolesGuard).
   * Omitted on legacy/manual contexts; guards fall back to [tenantRole] when empty.
   */
  tenantRoles?: string[]

  constructor(partial: Partial<UserContext>) {
    Object.assign(this, partial)
    if (this.tenantRoles === undefined) {
      this.tenantRoles = this.tenantRole ? [this.tenantRole] : []
    }
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

  const roles = parseCustomRolesJson(claims['custom:roles'])

  // Determine tenant code
  // 1. Cognito custom:tenant attribute takes priority
  // 2. Otherwise, use header value (security check delegated to RolesGuard)
  // Note: tenantCode is normalized to lowercase for case-insensitive matching with role.tenant
  const tenantCode = (
    claims['custom:tenant'] || (ctx?.event?.headers || {})[HEADER_TENANT_CODE]
  )?.toLowerCase()

  const tenantRoles = resolveTenantRoles(claims, tenantCode)

  // Find tenantRole from direct custom:roles only (case-insensitive matching)
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
    tenantRoles,
  }
}
