import { ExecutionContext } from '@nestjs/common'

import { TenantGroupMembership } from '../auth/group-role-resolver.interface'
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
  /** Direct roles from custom:roles for the active tenant (excludes group-derived roles). */
  tenantRoles: string[]
  /** Group IDs from custom:groups for the active tenant. */
  tenantGroupIds: string[]

  constructor(partial: Partial<UserContext>) {
    Object.assign(this, partial)
  }
}

function parseTenantGroups(
  raw: string | undefined,
  tenantCode: string | undefined,
): string[] {
  if (!tenantCode) {
    return []
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw || '[]')
  } catch {
    return []
  }

  if (!Array.isArray(parsed)) {
    return []
  }

  const memberships = (parsed as TenantGroupMembership[]).map((membership) => ({
    ...membership,
    tenant: (membership.tenant || '').toLowerCase(),
  }))

  const match = memberships.find(
    (membership) => membership.tenant === tenantCode,
  )
  const groups = match?.groups
  return Array.isArray(groups) ? groups : []
}

function collectTenantRoles(
  roles: CustomRole[],
  tenantCode: string | undefined,
): string[] {
  if (!tenantCode) {
    return []
  }
  const seen = new Set<string>()
  const result: string[] = []
  const add = (role: string) => {
    if (!seen.has(role)) {
      seen.add(role)
      result.push(role)
    }
  }
  for (const { tenant, role } of roles) {
    if (tenant === tenantCode) {
      add(role)
    }
  }
  for (const { tenant, role } of roles) {
    if (tenant === '') {
      add(role)
    }
  }
  return result
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
  // Note: tenantCode is normalized to lowercase for case-insensitive matching with role.tenant
  const tenantCode = (
    claims['custom:tenant'] || (ctx?.event?.headers || {})[HEADER_TENANT_CODE]
  )?.toLowerCase()

  const tenantGroupIds = parseTenantGroups(claims['custom:groups'], tenantCode)
  const tenantRoles = collectTenantRoles(roles, tenantCode)

  // Find tenantRole (case-insensitive matching - both tenantCode and role.tenant are lowercase)
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
    tenantGroupIds,
  }
}
