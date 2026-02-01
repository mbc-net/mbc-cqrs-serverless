export const HEADER_TENANT_CODE = 'x-tenant-code'

/**
 * @deprecated Use DEFAULT_COMMON_TENANT_CODES instead. Will be removed in v1.2.0.
 * Common tenant code for shared resources.
 */
export const TENANT_COMMON = process.env.COMMON_TENANT_CODES?.split(',')[0]?.trim() || 'common'

export const DEFAULT_TENANT_CODE = 'single'

/**
 * List of common tenant codes that anyone can access via header override.
 * Can be customized via COMMON_TENANT_CODES environment variable (comma-separated).
 * Applications can also override by extending RolesGuard and overriding getCommonTenantCodes().
 *
 * Example: COMMON_TENANT_CODES=common,shared,public
 */
export const DEFAULT_COMMON_TENANT_CODES = (
  process.env.COMMON_TENANT_CODES || 'common'
)
  .split(',')
  .map((c) => c.trim())
  .filter((c) => c.length > 0)

/**
 * List of roles that can perform cross-tenant operations.
 * Can be customized via CROSS_TENANT_ROLES environment variable (comma-separated).
 * Applications can also override by extending RolesGuard and overriding getCrossTenantRoles().
 *
 * Example: CROSS_TENANT_ROLES=system_admin,general_manager
 */
export const DEFAULT_CROSS_TENANT_ROLES = (
  process.env.CROSS_TENANT_ROLES || 'system_admin'
)
  .split(',')
  .map((r) => r.trim())
  .filter((r) => r.length > 0)
