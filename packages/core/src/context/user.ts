import { ExecutionContext } from '@nestjs/common'

import { TenantGroupMembership } from '../auth/group-role-resolver.interface'
import {
  getExplicitTenantSelectionCodes,
  HEADER_TENANT_CODE,
  ROLE_SYSTEM_ADMIN,
} from '../constants'
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
  explicitSelection = false,
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
    tenant: explicitSelection
      ? (membership.tenant || '').trim().toLowerCase()
      : (membership.tenant || '').toLowerCase(),
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
 * 1. An opted-in header with direct membership or system_admin selects that tenant.
 * 2. Otherwise use the JWT home tenant, falling back to legacy header selection.
 * An unauthorized opted-in header without a home tenant resolves no tenant.
 *
 * Explicit selection eligibility is validated here so guards and services agree.
 * RolesGuard validates legacy header access and route permissions.
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

  const rawHeader = (ctx?.event?.headers || {})[HEADER_TENANT_CODE]
  const headerTenantCode =
    typeof rawHeader === 'string' ? rawHeader.trim().toLowerCase() : undefined
  const optedHeader =
    getExplicitTenantSelectionCodes().includes(headerTenantCode)
  const isSystemAdmin = roles.some(({ role }) => role === ROLE_SYSTEM_ADMIN)
  const explicitSelection =
    optedHeader &&
    (isSystemAdmin ||
      roles.some(
        ({ tenant, role }) =>
          tenant.trim() === headerTenantCode &&
          typeof role === 'string' &&
          role.length > 0,
      ))
  // Preserve legacy precedence outside opted-in headers. Unauthorized selection
  // falls back to home, never to public header access when there is no home.
  const tenantCode = explicitSelection
    ? headerTenantCode
    : optedHeader
      ? claims['custom:tenant']?.toLowerCase() || undefined
      : (claims['custom:tenant'] || rawHeader)?.toLowerCase()

  const tenantGroupIds = parseTenantGroups(
    claims['custom:groups'],
    tenantCode,
    explicitSelection,
  )
  const selectedRoles = explicitSelection
    ? roles
        .filter(({ tenant }) => tenant.trim() === tenantCode)
        .map((role) => ({ ...role, tenant: role.tenant.trim() }))
    : roles
  const tenantRoles = collectTenantRoles(selectedRoles, tenantCode)
  if (
    explicitSelection &&
    isSystemAdmin &&
    !tenantRoles.includes(ROLE_SYSTEM_ADMIN)
  ) {
    tenantRoles.push(ROLE_SYSTEM_ADMIN)
  }

  // Find tenantRole (case-insensitive matching - both tenantCode and role.tenant are lowercase)
  let tenantRole = ''
  for (const { tenant, role } of selectedRoles) {
    if (tenant === '' || tenant === tenantCode) {
      tenantRole = role
      if (tenant !== '') {
        break
      }
    }
  }

  if (explicitSelection && isSystemAdmin) tenantRole = ROLE_SYSTEM_ADMIN

  return {
    userId,
    tenantRole,
    tenantCode,
    tenantRoles,
    tenantGroupIds,
  }
}
