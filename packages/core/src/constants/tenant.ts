export const HEADER_TENANT_CODE = 'x-tenant-code'
export const TENANT_COMMON = 'common'
export const DEFAULT_TENANT_CODE = 'single'

/**
 * Default list of roles that can perform cross-tenant operations.
 * Applications can override this by extending RolesGuard and overriding getCrossTenantRoles().
 */
export const DEFAULT_CROSS_TENANT_ROLES = ['system_admin']
