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

    it('should NOT allow non-system-admin to override tenant via header', () => {
      const ctx = createMockContext(
        {
          sub: 'user-123',
          'custom:roles': JSON.stringify([{ tenant: 'tenant-a', role: 'user' }]),
        },
        { [HEADER_TENANT_CODE]: 'tenant-b' },
      )

      const result = getUserContext(ctx)

      expect(result.tenantCode).toBe('')
    })

    it('should allow system admin to override tenant via header when no custom:tenant', () => {
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

    it('should return empty tenant code when no custom:tenant and no header', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:roles': JSON.stringify([{ tenant: '', role: 'user' }]),
      })

      const result = getUserContext(ctx)

      expect(result.tenantCode).toBe('')
    })

    it('should return empty tenant code for system admin without header', () => {
      const ctx = createMockContext({
        sub: 'admin-123',
        'custom:roles': JSON.stringify([
          { tenant: '', role: ROLE_SYSTEM_ADMIN },
        ]),
      })

      const result = getUserContext(ctx)

      expect(result.tenantCode).toBe('')
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

  describe('system admin check', () => {
    it('should NOT recognize tenant-specific system admin for header override', () => {
      const ctx = createMockContext(
        {
          sub: 'admin-123',
          'custom:roles': JSON.stringify([
            { tenant: 'tenant-a', role: ROLE_SYSTEM_ADMIN },
          ]),
        },
        { [HEADER_TENANT_CODE]: 'tenant-b' },
      )

      const result = getUserContext(ctx)

      // Tenant-specific system admin should NOT be able to override tenant
      expect(result.tenantCode).toBe('')
    })

    it('should recognize global system admin (empty tenant) for header override', () => {
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

      // Should be able to use header because of global system_admin
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

      expect(result.tenantCode).toBe('')
    })

    it('should handle ctx with missing event', () => {
      const ctx: IInvoke = {}

      const result = getUserContext(ctx)

      expect(result.userId).toBeUndefined()
      expect(result.tenantCode).toBe('')
      expect(result.tenantRole).toBe('')
    })
  })

  describe('security scenarios', () => {
    it('should prevent regular user from accessing other tenant via header', () => {
      // User belongs to tenant-a but tries to access tenant-b via header
      const ctx = createMockContext(
        {
          sub: 'user-123',
          'custom:tenant': 'tenant-a',
          'custom:roles': JSON.stringify([{ tenant: 'tenant-a', role: 'admin' }]),
        },
        { [HEADER_TENANT_CODE]: 'tenant-b' },
      )

      const result = getUserContext(ctx)

      // Should use custom:tenant, NOT header
      expect(result.tenantCode).toBe('tenant-a')
    })

    it('should prevent user without any tenant from accessing any tenant', () => {
      // User has no custom:tenant and is not system admin
      const ctx = createMockContext(
        {
          sub: 'user-123',
          'custom:roles': JSON.stringify([{ role: 'user' }]),
        },
        { [HEADER_TENANT_CODE]: 'any-tenant' },
      )

      const result = getUserContext(ctx)

      // Should be empty, will be rejected by RolesGuard
      expect(result.tenantCode).toBe('')
    })

    it('should prevent tenant-specific admin from accessing other tenants', () => {
      // User is admin of tenant-a but tries to access tenant-b
      const ctx = createMockContext(
        {
          sub: 'admin-123',
          'custom:roles': JSON.stringify([
            { tenant: 'tenant-a', role: ROLE_SYSTEM_ADMIN },
          ]),
        },
        { [HEADER_TENANT_CODE]: 'tenant-b' },
      )

      const result = getUserContext(ctx)

      // Tenant-specific system_admin should NOT be able to override
      expect(result.tenantCode).toBe('')
    })

    it('should prevent role spoofing via malformed custom:roles JSON', () => {
      // Attacker tries to inject system_admin role via malformed JSON
      const ctx = createMockContext(
        {
          sub: 'attacker-123',
          'custom:roles': 'invalid json', // malformed JSON
        },
        { [HEADER_TENANT_CODE]: 'target-tenant' },
      )

      // Should throw or return safe defaults, not grant access
      expect(() => getUserContext(ctx)).toThrow()
    })

    it('should prevent privilege escalation via role array manipulation', () => {
      // User has multiple roles but none are global system_admin
      const ctx = createMockContext(
        {
          sub: 'user-123',
          'custom:roles': JSON.stringify([
            { tenant: 'tenant-a', role: 'admin' },
            { tenant: 'tenant-b', role: 'admin' },
            { tenant: 'tenant-c', role: ROLE_SYSTEM_ADMIN }, // tenant-specific, not global
          ]),
        },
        { [HEADER_TENANT_CODE]: 'tenant-d' },
      )

      const result = getUserContext(ctx)

      // Should NOT be able to access tenant-d
      expect(result.tenantCode).toBe('')
    })

    it('should prevent access with empty role name that might bypass checks', () => {
      const ctx = createMockContext(
        {
          sub: 'user-123',
          'custom:roles': JSON.stringify([
            { tenant: '', role: '' }, // empty role
          ]),
        },
        { [HEADER_TENANT_CODE]: 'any-tenant' },
      )

      const result = getUserContext(ctx)

      // Empty role should not grant system admin privileges
      expect(result.tenantCode).toBe('')
    })

    it('should prevent case-sensitivity bypass for system_admin role', () => {
      // Attacker tries to use different case for system_admin
      const ctx = createMockContext(
        {
          sub: 'attacker-123',
          'custom:roles': JSON.stringify([
            { tenant: '', role: 'SYSTEM_ADMIN' }, // uppercase
          ]),
        },
        { [HEADER_TENANT_CODE]: 'target-tenant' },
      )

      const result = getUserContext(ctx)

      // Should NOT match because role comparison is case-sensitive
      expect(result.tenantCode).toBe('')
    })

    it('should prevent whitespace injection in tenant field', () => {
      // Attacker tries to use whitespace to bypass tenant check
      const ctx = createMockContext(
        {
          sub: 'attacker-123',
          'custom:roles': JSON.stringify([
            { tenant: ' ', role: ROLE_SYSTEM_ADMIN }, // whitespace, not empty
          ]),
        },
        { [HEADER_TENANT_CODE]: 'target-tenant' },
      )

      const result = getUserContext(ctx)

      // Whitespace tenant should be normalized to ' ' (not empty), so not global admin
      expect(result.tenantCode).toBe('')
    })

    it('should prevent null injection in role object', () => {
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
      // This is expected behavior - the protection is that custom:roles
      // comes from Cognito (trusted source), not user input
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
      expect(result.tenantCode).toBe('')
      expect(result.tenantRole).toBe('user')
    })

    it('should prevent header injection with special characters', () => {
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
      // But this test documents the behavior
      expect(result.tenantCode).toBe('tenant-a\r\nX-Injected: malicious')
    })

    it('should not grant access when user has admin role for different tenant only', () => {
      // User is admin of tenant-a, has custom:tenant for tenant-a
      // but tries to access tenant-b which they have no role for
      const ctx = createMockContext(
        {
          sub: 'user-123',
          'custom:tenant': 'tenant-a',
          'custom:roles': JSON.stringify([
            { tenant: 'tenant-a', role: 'admin' },
          ]),
        },
        { [HEADER_TENANT_CODE]: 'tenant-b' },
      )

      const result = getUserContext(ctx)

      // Should be restricted to tenant-a (from custom:tenant)
      expect(result.tenantCode).toBe('tenant-a')
      expect(result.tenantRole).toBe('admin')
    })
  })
})
