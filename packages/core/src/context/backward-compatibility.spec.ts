import { HEADER_TENANT_CODE, ROLE_SYSTEM_ADMIN } from '../constants'
import { IInvoke, JwtClaims } from './invoke'
import { getUserContext, UserContext } from './user'

/**
 * Backward Compatibility and Migration Tests for getUserContext
 *
 * These tests ensure that:
 * 1. Existing data with uppercase tenant codes works correctly
 * 2. API responses are consistent (always lowercase tenantCode)
 * 3. Multi-tenant access with different case combinations works
 * 4. Migration from uppercase to lowercase is seamless
 */
describe('getUserContext - Backward Compatibility and Migration', () => {
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

  describe('Migration from uppercase tenant codes', () => {
    it('should handle legacy uppercase tenant code from Cognito', () => {
      // Simulates existing user with uppercase tenant code in Cognito
      const ctx = createMockContext({
        sub: 'legacy-user-123',
        'custom:tenant': 'LEGACY_TENANT',
        'custom:roles': JSON.stringify([
          { tenant: 'LEGACY_TENANT', role: 'admin' },
        ]),
      })

      const result = getUserContext(ctx)

      // tenantCode should be normalized to lowercase
      expect(result.tenantCode).toBe('legacy_tenant')
      // Role should still match (case-insensitive comparison)
      expect(result.tenantRole).toBe('admin')
    })

    it('should handle mixed case roles from legacy systems', () => {
      // Legacy system might have roles defined with various case combinations
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'MyTenant',
        'custom:roles': JSON.stringify([
          { tenant: 'MYTENANT', role: 'Admin' }, // uppercase tenant in role
          { tenant: 'mytenant', role: 'User' }, // lowercase tenant in role
        ]),
      })

      const result = getUserContext(ctx)

      // Should match first role (both normalized to 'mytenant')
      expect(result.tenantCode).toBe('mytenant')
      expect(result.tenantRole).toBe('Admin')
    })

    it('should handle header with legacy uppercase format', () => {
      const ctx = createMockContext(
        {
          sub: 'admin-123',
          'custom:roles': JSON.stringify([
            { tenant: '', role: ROLE_SYSTEM_ADMIN },
          ]),
        },
        { [HEADER_TENANT_CODE]: 'LEGACY_TENANT_CODE' },
      )

      const result = getUserContext(ctx)

      // Header value normalized to lowercase
      expect(result.tenantCode).toBe('legacy_tenant_code')
    })
  })

  describe('API response consistency', () => {
    it('should always return lowercase tenantCode regardless of input case', () => {
      const testCases = [
        { input: 'UPPERCASE', expected: 'uppercase' },
        { input: 'lowercase', expected: 'lowercase' },
        { input: 'MixedCase', expected: 'mixedcase' },
        { input: 'snake_CASE_Mixed', expected: 'snake_case_mixed' },
        { input: 'kebab-CASE-Mixed', expected: 'kebab-case-mixed' },
        { input: 'PascalCase', expected: 'pascalcase' },
        { input: 'camelCase', expected: 'camelcase' },
      ]

      for (const { input, expected } of testCases) {
        const ctx = createMockContext({
          sub: 'user-123',
          'custom:tenant': input,
          'custom:roles': JSON.stringify([{ tenant: input, role: 'user' }]),
        })

        const result = getUserContext(ctx)

        expect(result.tenantCode).toBe(expected)
      }
    })

    it('should return consistent tenantCode format across different sources', () => {
      // From custom:tenant
      const ctx1 = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'MyTenant',
        'custom:roles': JSON.stringify([]),
      })

      // From header
      const ctx2 = createMockContext(
        {
          sub: 'user-123',
          'custom:roles': JSON.stringify([]),
        },
        { [HEADER_TENANT_CODE]: 'MyTenant' },
      )

      const result1 = getUserContext(ctx1)
      const result2 = getUserContext(ctx2)

      // Both should produce the same normalized tenantCode
      expect(result1.tenantCode).toBe('mytenant')
      expect(result2.tenantCode).toBe('mytenant')
    })

    it('should maintain UserContext structure for backward compatibility', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'tenant-a',
        'custom:roles': JSON.stringify([{ tenant: 'tenant-a', role: 'admin' }]),
      })

      const result = getUserContext(ctx)

      // Verify the structure matches UserContext interface
      expect(result).toHaveProperty('userId')
      expect(result).toHaveProperty('tenantCode')
      expect(result).toHaveProperty('tenantRole')

      // Verify types
      expect(typeof result.userId).toBe('string')
      expect(typeof result.tenantCode).toBe('string')
      expect(typeof result.tenantRole).toBe('string')
    })
  })

  describe('Multi-tenant access with different case combinations', () => {
    it('should allow same user to access data with different tenant code cases', () => {
      // Same tenant, different case in input - should all resolve to same tenant
      const tenantVariations = ['TenantA', 'tenanta', 'TENANTA', 'TeNaNtA']

      const results = tenantVariations.map((tenant) => {
        const ctx = createMockContext({
          sub: 'user-123',
          'custom:tenant': tenant,
          'custom:roles': JSON.stringify([{ tenant: 'tenanta', role: 'user' }]),
        })
        return getUserContext(ctx)
      })

      // All should resolve to the same lowercase tenantCode
      const tenantCodes = results.map((r) => r.tenantCode)
      expect(new Set(tenantCodes).size).toBe(1)
      expect(tenantCodes[0]).toBe('tenanta')

      // All should find the matching role
      const roles = results.map((r) => r.tenantRole)
      expect(roles.every((r) => r === 'user')).toBe(true)
    })

    it('should correctly match roles defined with different cases', () => {
      // Role defined with various case combinations
      const roleDefinitions = [
        { tenant: 'TENANT_A', role: 'uppercase-admin' },
        { tenant: 'tenant_b', role: 'lowercase-admin' },
        { tenant: 'Tenant_C', role: 'mixed-admin' },
        { tenant: '', role: 'global-admin' },
      ]

      // Test matching each role
      const testCases = [
        { tenantInput: 'tenant_a', expectedRole: 'uppercase-admin' },
        { tenantInput: 'TENANT_B', expectedRole: 'lowercase-admin' },
        { tenantInput: 'tenant_c', expectedRole: 'mixed-admin' },
        { tenantInput: 'unknown_tenant', expectedRole: 'global-admin' },
      ]

      for (const { tenantInput, expectedRole } of testCases) {
        const ctx = createMockContext({
          sub: 'user-123',
          'custom:tenant': tenantInput,
          'custom:roles': JSON.stringify(roleDefinitions),
        })

        const result = getUserContext(ctx)

        expect(result.tenantRole).toBe(expectedRole)
      }
    })
  })

  describe('Regression tests for tenant code normalization', () => {
    it('should not break existing workflows with lowercase tenant codes', () => {
      // Existing workflow with lowercase tenant codes should work unchanged
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'existing-tenant',
        'custom:roles': JSON.stringify([
          { tenant: 'existing-tenant', role: 'admin' },
        ]),
      })

      const result = getUserContext(ctx)

      expect(result.tenantCode).toBe('existing-tenant')
      expect(result.tenantRole).toBe('admin')
      expect(result.userId).toBe('user-123')
    })

    it('should handle special characters in tenant codes consistently', () => {
      const specialCases = [
        { input: 'tenant-with-dashes', expected: 'tenant-with-dashes' },
        { input: 'tenant_with_underscores', expected: 'tenant_with_underscores' },
        { input: 'tenant.with.dots', expected: 'tenant.with.dots' },
        { input: 'tenant123', expected: 'tenant123' },
        { input: '123tenant', expected: '123tenant' },
      ]

      for (const { input, expected } of specialCases) {
        const ctx = createMockContext({
          sub: 'user-123',
          'custom:tenant': input,
          'custom:roles': JSON.stringify([{ tenant: input, role: 'user' }]),
        })

        const result = getUserContext(ctx)

        expect(result.tenantCode).toBe(expected)
        expect(result.tenantRole).toBe('user')
      }
    })

    it('should handle empty and whitespace tenant codes', () => {
      // Empty string becomes undefined (falsy value)
      const ctx1 = createMockContext({
        sub: 'user-123',
        'custom:tenant': '',
        'custom:roles': JSON.stringify([{ tenant: '', role: 'global' }]),
      })

      const result1 = getUserContext(ctx1)
      // Note: Empty string is falsy, so tenantCode becomes undefined
      expect(result1.tenantCode).toBeUndefined()
      // Global role (empty tenant) is still matched
      expect(result1.tenantRole).toBe('global')

      // Whitespace (should be preserved but lowercased)
      const ctx2 = createMockContext({
        sub: 'user-123',
        'custom:tenant': '  SPACES  ',
        'custom:roles': JSON.stringify([{ tenant: '  spaces  ', role: 'user' }]),
      })

      const result2 = getUserContext(ctx2)
      expect(result2.tenantCode).toBe('  spaces  ')
      expect(result2.tenantRole).toBe('user')
    })

    it('should preserve role values without modification', () => {
      // Role values should not be normalized
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'tenant-a',
        'custom:roles': JSON.stringify([
          { tenant: 'tenant-a', role: 'Admin_Role' },
        ]),
      })

      const result = getUserContext(ctx)

      // Role value is preserved as-is
      expect(result.tenantRole).toBe('Admin_Role')
    })

    it('should preserve userId without modification', () => {
      const ctx = createMockContext({
        sub: 'User-UUID-123-ABC',
        'custom:tenant': 'tenant-a',
        'custom:roles': JSON.stringify([]),
      })

      const result = getUserContext(ctx)

      // userId is preserved as-is (not normalized)
      expect(result.userId).toBe('User-UUID-123-ABC')
    })
  })

  describe('Cross-tenant role access patterns', () => {
    it('should allow system admin to access any tenant with header override', () => {
      const targetTenants = ['Tenant-A', 'TENANT_B', 'tenant-c']

      for (const targetTenant of targetTenants) {
        const ctx = createMockContext(
          {
            sub: 'admin-123',
            'custom:roles': JSON.stringify([
              { tenant: '', role: ROLE_SYSTEM_ADMIN },
            ]),
          },
          { [HEADER_TENANT_CODE]: targetTenant },
        )

        const result = getUserContext(ctx)

        // tenantCode is normalized
        expect(result.tenantCode).toBe(targetTenant.toLowerCase())
        // System admin role is preserved
        expect(result.tenantRole).toBe(ROLE_SYSTEM_ADMIN)
      }
    })

    it('should correctly determine tenant-specific role over global when both exist', () => {
      // User has both global and tenant-specific roles
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'TARGET_TENANT',
        'custom:roles': JSON.stringify([
          { tenant: '', role: 'global-viewer' },
          { tenant: 'OTHER_TENANT', role: 'other-admin' },
          { tenant: 'target_tenant', role: 'target-admin' }, // lowercase in definition
        ]),
      })

      const result = getUserContext(ctx)

      // Should match target_tenant role (case-insensitive)
      expect(result.tenantCode).toBe('target_tenant')
      expect(result.tenantRole).toBe('target-admin')
    })
  })

  describe('Version migration scenarios', () => {
    it('should handle data migrated from pre-normalization version', () => {
      // Simulates scenario where Cognito data was set before normalization was added
      // Old data might have uppercase, new code should handle it
      const legacyCtx = createMockContext({
        sub: 'legacy-user',
        'custom:tenant': 'LEGACY_TENANT_ABC',
        'custom:roles': JSON.stringify([
          { tenant: 'LEGACY_TENANT_ABC', role: 'legacy-role' },
        ]),
      })

      const result = getUserContext(legacyCtx)

      // Code handles legacy uppercase data
      expect(result.tenantCode).toBe('legacy_tenant_abc')
      expect(result.tenantRole).toBe('legacy-role')
    })

    it('should handle mixed old and new role definitions', () => {
      // Simulates gradual migration where some roles are old (uppercase) and some are new (lowercase)
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'MyTenant',
        'custom:roles': JSON.stringify([
          { tenant: 'MYTENANT', role: 'old-role' }, // old format
          { tenant: 'mytenant', role: 'new-role' }, // new format
        ]),
      })

      const result = getUserContext(ctx)

      // First matching role is used (both match after normalization)
      expect(result.tenantCode).toBe('mytenant')
      expect(result.tenantRole).toBe('old-role')
    })

    it('should work with roles added in different versions of the application', () => {
      // Role array might contain entries added at different times with different conventions
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'Company_ABC',
        'custom:roles': JSON.stringify([
          // v1.0 format (uppercase)
          { tenant: 'COMPANY_ABC', role: 'v1_admin' },
          // v1.5 format (mixed case)
          { tenant: 'Company_Abc', role: 'v15_admin' },
          // v2.0 format (lowercase)
          { tenant: 'company_abc', role: 'v2_admin' },
          // Global role
          { tenant: '', role: 'viewer' },
        ]),
      })

      const result = getUserContext(ctx)

      // Should match first role that matches (all three match after normalization)
      expect(result.tenantCode).toBe('company_abc')
      expect(result.tenantRole).toBe('v1_admin')
    })
  })

  describe('Concurrent access scenarios', () => {
    it('should produce consistent results for concurrent calls with same input', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'TenantA',
        'custom:roles': JSON.stringify([{ tenant: 'tenanta', role: 'user' }]),
      })

      // Simulate concurrent calls
      const results = Array.from({ length: 100 }, () => getUserContext(ctx))

      // All results should be identical
      const firstResult = results[0]
      expect(results.every((r) => r.tenantCode === firstResult.tenantCode)).toBe(
        true,
      )
      expect(results.every((r) => r.tenantRole === firstResult.tenantRole)).toBe(
        true,
      )
      expect(results.every((r) => r.userId === firstResult.userId)).toBe(true)
    })

    it('should handle rapid succession of different tenant accesses', () => {
      const tenants = ['TenantA', 'TENANTB', 'tenant_c', 'TENANT-D']
      const results: UserContext[] = []

      for (const tenant of tenants) {
        const ctx = createMockContext({
          sub: 'user-123',
          'custom:tenant': tenant,
          'custom:roles': JSON.stringify([
            { tenant: tenant.toLowerCase(), role: `role-${tenant}` },
          ]),
        })

        results.push(getUserContext(ctx))
      }

      // Each result should have correctly normalized tenantCode
      expect(results[0].tenantCode).toBe('tenanta')
      expect(results[1].tenantCode).toBe('tenantb')
      expect(results[2].tenantCode).toBe('tenant_c')
      expect(results[3].tenantCode).toBe('tenant-d')
    })
  })
})
