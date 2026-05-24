import { JwtClaims } from './invoke'
import { CustomRole } from './user'

export function parseCustomRolesJson(json: string | undefined): CustomRole[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed)) return []
    return parsed.map((entry) => ({
      ...entry,
      tenant: (entry.tenant || '').toLowerCase(),
    }))
  } catch {
    return []
  }
}

export function resolveTenantRoles(
  claims: JwtClaims,
  tenantCode: string | undefined,
): string[] {
  const normalizedTenant = tenantCode?.toLowerCase()
  const direct = parseCustomRolesJson(claims['custom:roles'])
  const fromGroups = parseCustomRolesJson(claims['custom:groups'])
  const merged = [...direct, ...fromGroups]

  const roles: string[] = []
  const seen = new Set<string>()

  for (const { tenant, role } of merged) {
    if (normalizedTenant && tenant !== '' && tenant !== normalizedTenant) {
      continue
    }
    if (!normalizedTenant && tenant !== '') {
      continue
    }
    if (!role || seen.has(role)) {
      continue
    }
    seen.add(role)
    roles.push(role)
  }

  return roles
}
