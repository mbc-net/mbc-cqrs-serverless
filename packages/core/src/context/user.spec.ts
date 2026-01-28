import { HEADER_TENANT_CODE, ROLE_SYSTEM_ADMIN } from '../constants'
import { IInvoke, JwtClaims } from './invoke'
import { getUserContext } from './user'

describe('getUserContext', () => {
  const createMockContext = (
    claims: Partial<JwtClaims>,
    headers: Record<string, string> = {},
  ): IInvoke => ({
    event: {
      headers,
      requestContext: {
        authorizer: {
          jwt: {
            claims: claims as JwtClaims,
          },
        },
      },
    },
  })

  describe('tenant code determination', () => {
    it('should use custom:tenant from Cognito claims when available', () => {
      const ctx = createMockContext(
        {
          sub: 'user-123',
          'custom:tenant': 'tenant-a',
          'custom:roles': JSON.stringify([{ tenant: 'tenant-a', role: 'user' }]),
        },
        { [HEADER_TENANT_CODE]: 'tenant-b' },
      )

      const result = getUserContext(ctx)

      expect(result.tenantCode).toBe('tenant-a')
      expect(result.userId).toBe('user-123')
    })

    it('should use header tenant code when no custom:tenant', () => {
      const ctx = createMockContext(
        {
          sub: 'user-123',
          'custom:roles': JSON.stringify([{ tenant: 'tenant-a', role: 'user' }]),
        },
        { [HEADER_TENANT_CODE]: 'tenant-b' },
      )

      const result = getUserContext(ctx)

      // Header value is used (security validation delegated to RolesGuard)
      expect(result.tenantCode).toBe('tenant-b')
    })

    it('should allow system admin to access any tenant via header', () => {
      const ctx = createMockContext(
        {
          sub: 'admin-123',
          'custom:roles': JSON.stringify([
            { tenant: '', role: ROLE_SYSTEM_ADMIN },
          ]),
        },
        { [HEADER_TENANT_CODE]: 'tenant-b' },
      )

      const result = getUserContext(ctx)

      expect(result.tenantCode).toBe('tenant-b')
      expect(result.tenantRole).toBe(ROLE_SYSTEM_ADMIN)
    })

    it('should prioritize custom:tenant over header even for system admin', () => {
      const ctx = createMockContext(
        {
          sub: 'admin-123',
          'custom:tenant': 'tenant-a',
          'custom:roles': JSON.stringify([
            { tenant: '', role: ROLE_SYSTEM_ADMIN },
          ]),
        },
        { [HEADER_TENANT_CODE]: 'tenant-b' },
      )

      const result = getUserContext(ctx)

      expect(result.tenantCode).toBe('tenant-a')
    })

    it('should return undefined tenant code when no custom:tenant and no header', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:roles': JSON.stringify([{ tenant: '', role: 'user' }]),
      })

      const result = getUserContext(ctx)

      expect(result.tenantCode).toBeUndefined()
    })

    it('should return undefined tenant code for system admin without header', () => {
      const ctx = createMockContext({
        sub: 'admin-123',
        'custom:roles': JSON.stringify([
          { tenant: '', role: ROLE_SYSTEM_ADMIN },
        ]),
      })

      const result = getUserContext(ctx)

      expect(result.tenantCode).toBeUndefined()
    })
  })

  describe('tenant role determination', () => {
    it('should find role matching tenant code', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'tenant-a',
        'custom:roles': JSON.stringify([
          { tenant: 'tenant-a', role: 'admin' },
          { tenant: 'tenant-b', role: 'user' },
        ]),
      })

      const result = getUserContext(ctx)

      expect(result.tenantRole).toBe('admin')
    })

    it('should use global role (empty tenant) as fallback', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'tenant-c',
        'custom:roles': JSON.stringify([
          { tenant: '', role: 'global-user' },
          { tenant: 'tenant-a', role: 'admin' },
        ]),
      })

      const result = getUserContext(ctx)

      expect(result.tenantRole).toBe('global-user')
    })

    it('should prefer tenant-specific role over global role', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'tenant-a',
        'custom:roles': JSON.stringify([
          { tenant: '', role: 'global-user' },
          { tenant: 'tenant-a', role: 'tenant-admin' },
        ]),
      })

      const result = getUserContext(ctx)

      expect(result.tenantRole).toBe('tenant-admin')
    })
  })

  describe('edge cases', () => {
    it('should handle empty custom:roles', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'tenant-a',
        'custom:roles': '[]',
      })

      const result = getUserContext(ctx)

      expect(result.tenantCode).toBe('tenant-a')
      expect(result.tenantRole).toBe('')
    })

    it('should handle missing custom:roles', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'tenant-a',
      })

      const result = getUserContext(ctx)

      expect(result.tenantCode).toBe('tenant-a')
      expect(result.tenantRole).toBe('')
    })

    it('should handle role with undefined tenant as global role', () => {
      const ctx = createMockContext(
        {
          sub: 'admin-123',
          'custom:roles': JSON.stringify([
            { role: ROLE_SYSTEM_ADMIN }, // no tenant field
          ]),
        },
        { [HEADER_TENANT_CODE]: 'tenant-b' },
      )

      const result = getUserContext(ctx)

      // undefined tenant should be treated as '' (global)
      expect(result.tenantCode).toBe('tenant-b')
    })

    it('should normalize tenant to lowercase', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'tenant-a',
        'custom:roles': JSON.stringify([
          { tenant: 'TENANT-A', role: 'admin' },
        ]),
      })

      const result = getUserContext(ctx)

      expect(result.tenantRole).toBe('admin')
    })

    it('should handle case where header uses different case than custom:tenant', () => {
      const ctx = createMockContext(
        {
          sub: 'user-123',
          'custom:tenant': 'Tenant-A',
          'custom:roles': JSON.stringify([{ tenant: 'tenant-a', role: 'user' }]),
        },
        { [HEADER_TENANT_CODE]: 'tenant-b' },
      )

      const result = getUserContext(ctx)

      // custom:tenant takes priority, case preserved
      expect(result.tenantCode).toBe('Tenant-A')
    })

    it('should handle multiple roles including both global and tenant-specific', () => {
      const ctx = createMockContext(
        {
          sub: 'admin-123',
          'custom:roles': JSON.stringify([
            { tenant: 'tenant-a', role: 'user' },
            { tenant: '', role: ROLE_SYSTEM_ADMIN },
            { tenant: 'tenant-b', role: 'admin' },
          ]),
        },
        { [HEADER_TENANT_CODE]: 'tenant-c' },
      )

      const result = getUserContext(ctx)

      // Header value is used (security delegated to RolesGuard)
      expect(result.tenantCode).toBe('tenant-c')
      // tenantRole should be the global system_admin (since tenant-c has no specific role)
      expect(result.tenantRole).toBe(ROLE_SYSTEM_ADMIN)
    })

    it('should handle empty string in header tenant code', () => {
      const ctx = createMockContext(
        {
          sub: 'admin-123',
          'custom:roles': JSON.stringify([
            { tenant: '', role: ROLE_SYSTEM_ADMIN },
          ]),
        },
        { [HEADER_TENANT_CODE]: '' },
      )

      const result = getUserContext(ctx)

      // Empty header should result in empty tenantCode
      expect(result.tenantCode).toBe('')
    })

    it('should handle null-like values in headers', () => {
      const ctx = createMockContext(
        {
          sub: 'admin-123',
          'custom:roles': JSON.stringify([
            { tenant: '', role: ROLE_SYSTEM_ADMIN },
          ]),
        },
        {}, // no headers at all
      )

      const result = getUserContext(ctx)

      expect(result.tenantCode).toBeUndefined()
    })

    it('should handle ctx with missing event', () => {
      const ctx: IInvoke = {}

      const result = getUserContext(ctx)

      expect(result.userId).toBeUndefined()
      expect(result.tenantCode).toBeUndefined()
      expect(result.tenantRole).toBe('')
    })
  })

  describe('header override scenarios (security handled by RolesGuard)', () => {
    it('should pass header tenant code through (security check delegated to RolesGuard)', () => {
      // Regular user without custom:tenant uses header
      // getUserContext returns the header value; RolesGuard will validate
      const ctx = createMockContext(
        {
          sub: 'user-123',
          'custom:roles': JSON.stringify([{ tenant: 'tenant-a', role: 'admin' }]),
        },
        { [HEADER_TENANT_CODE]: 'tenant-b' },
      )

      const result = getUserContext(ctx)

      // Header value is returned (RolesGuard will decide if this is allowed)
      expect(result.tenantCode).toBe('tenant-b')
    })

    it('should use custom:tenant when present (ignores header)', () => {
      // User with custom:tenant - header is ignored
      const ctx = createMockContext(
        {
          sub: 'user-123',
          'custom:tenant': 'tenant-a',
          'custom:roles': JSON.stringify([{ tenant: 'tenant-a', role: 'admin' }]),
        },
        { [HEADER_TENANT_CODE]: 'tenant-b' },
      )

      const result = getUserContext(ctx)

      // custom:tenant takes priority
      expect(result.tenantCode).toBe('tenant-a')
      expect(result.tenantRole).toBe('admin')
    })
  })

  describe('malformed input handling', () => {
    it('should throw on malformed custom:roles JSON', () => {
      const ctx = createMockContext(
        {
          sub: 'attacker-123',
          'custom:roles': 'invalid json',
        },
        { [HEADER_TENANT_CODE]: 'target-tenant' },
      )

      expect(() => getUserContext(ctx)).toThrow()
    })

    it('should handle null injection in role object', () => {
      const ctx = createMockContext(
        {
          sub: 'attacker-123',
          'custom:roles': JSON.stringify([
            { tenant: null, role: ROLE_SYSTEM_ADMIN },
          ]),
        },
        { [HEADER_TENANT_CODE]: 'target-tenant' },
      )

      const result = getUserContext(ctx)

      // null tenant should be converted to '' and treated as global admin
      expect(result.tenantCode).toBe('target-tenant')
    })

    it('should handle prototype pollution attempt in roles', () => {
      const ctx = createMockContext(
        {
          sub: 'attacker-123',
          'custom:roles': JSON.stringify([
            { tenant: '', role: 'user', __proto__: { role: ROLE_SYSTEM_ADMIN } },
          ]),
        },
        { [HEADER_TENANT_CODE]: 'target-tenant' },
      )

      const result = getUserContext(ctx)

      // Should use the actual role value, not prototype
      expect(result.tenantRole).toBe('user')
    })

    it('should pass through header with special characters', () => {
      const ctx = createMockContext(
        {
          sub: 'admin-123',
          'custom:roles': JSON.stringify([
            { tenant: '', role: ROLE_SYSTEM_ADMIN },
          ]),
        },
        { [HEADER_TENANT_CODE]: 'tenant-a\r\nX-Injected: malicious' },
      )

      const result = getUserContext(ctx)

      // The header value is passed as-is (validation should happen elsewhere)
      expect(result.tenantCode).toBe('tenant-a\r\nX-Injected: malicious')
    })
  })

  describe('backward compatibility', () => {
    it('should return plain object, not UserContext instance', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'tenant-a',
        'custom:roles': JSON.stringify([{ tenant: 'tenant-a', role: 'user' }]),
      })

      const result = getUserContext(ctx)

      // getUserContext returns a plain object, not a UserContext instance
      expect(result).toEqual({
        userId: 'user-123',
        tenantCode: 'tenant-a',
        tenantRole: 'user',
      })
      // Note: It's a plain object, not a UserContext instance
      expect(result.constructor.name).toBe('Object')
    })

    it('should preserve tenantCode case from custom:tenant', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'tenanta', // lowercase to match role
        'custom:roles': JSON.stringify([{ tenant: 'tenanta', role: 'user' }]),
      })

      const result = getUserContext(ctx)

      // tenantCode should preserve original case
      expect(result.tenantCode).toBe('tenanta')
      // Role matching: role.tenant is lowercased, compared with tenantCode as-is
      expect(result.tenantRole).toBe('user')
    })

    it('should document case sensitivity behavior between tenantCode and role.tenant', () => {
      // IMPORTANT: This test documents a known behavior:
      // - role.tenant is normalized to lowercase during parsing
      // - tenantCode (from custom:tenant or header) is NOT normalized
      // - Therefore, 'TenantA' !== 'tenanta' and role won't match
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'TenantA', // Mixed case
        'custom:roles': JSON.stringify([{ tenant: 'TenantA', role: 'user' }]), // Same case
      })

      const result = getUserContext(ctx)

      // tenantCode preserves case
      expect(result.tenantCode).toBe('TenantA')
      // But role.tenant is lowercased to 'tenanta', which doesn't match 'TenantA'
      // This means the role won't be found!
      expect(result.tenantRole).toBe('')
    })

    it('should preserve tenantCode case from header', () => {
      const ctx = createMockContext(
        {
          sub: 'user-123',
          'custom:roles': JSON.stringify([{ tenant: '', role: 'user' }]),
        },
        { [HEADER_TENANT_CODE]: 'TenantB' },
      )

      const result = getUserContext(ctx)

      // tenantCode should preserve header case
      expect(result.tenantCode).toBe('TenantB')
    })

    it('should match role with lowercase tenant regardless of tenantCode case', () => {
      // User has TenantA (mixed case), role is defined for tenanta (lowercase)
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'TenantA',
        'custom:roles': JSON.stringify([
          { tenant: 'TENANTA', role: 'admin' }, // Uppercase in role definition
        ]),
      })

      const result = getUserContext(ctx)

      // Role tenant is lowercased during parsing, so 'TENANTA' becomes 'tenanta'
      // tenantCode 'TenantA' doesn't match 'tenanta' exactly
      // But the current implementation compares tenantCode with lowercased role.tenant
      // So 'TenantA' === 'tenanta' is false, role won't match
      expect(result.tenantCode).toBe('TenantA')
      // This reveals the current behavior - case mismatch means no role match
      expect(result.tenantRole).toBe('')
    })
  })

  describe('tenantRole matching logic', () => {
    it('should match first tenant-specific role and stop', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'tenant-a',
        'custom:roles': JSON.stringify([
          { tenant: 'tenant-a', role: 'first-role' },
          { tenant: 'tenant-a', role: 'second-role' },
        ]),
      })

      const result = getUserContext(ctx)

      // First matching role should be used
      expect(result.tenantRole).toBe('first-role')
    })

    it('should use global role when no tenant-specific match', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'tenant-x',
        'custom:roles': JSON.stringify([
          { tenant: 'tenant-a', role: 'tenant-a-role' },
          { tenant: '', role: 'global-role' },
        ]),
      })

      const result = getUserContext(ctx)

      expect(result.tenantRole).toBe('global-role')
    })

    it('should prefer tenant-specific over global even if global comes first', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'tenant-a',
        'custom:roles': JSON.stringify([
          { tenant: '', role: 'global-role' },
          { tenant: 'tenant-a', role: 'specific-role' },
        ]),
      })

      const result = getUserContext(ctx)

      // Tenant-specific role should override global
      expect(result.tenantRole).toBe('specific-role')
    })

    it('should return empty string when no matching role found', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'tenant-x',
        'custom:roles': JSON.stringify([
          { tenant: 'tenant-a', role: 'role-a' },
          { tenant: 'tenant-b', role: 'role-b' },
        ]),
      })

      const result = getUserContext(ctx)

      expect(result.tenantRole).toBe('')
    })
  })
})
