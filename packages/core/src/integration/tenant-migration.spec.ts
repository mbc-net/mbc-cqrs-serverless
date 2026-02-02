import { HEADER_TENANT_CODE, ROLE_SYSTEM_ADMIN } from '../constants'
import { IInvoke, JwtClaims } from '../context/invoke'
import { getUserContext } from '../context/user'

/**
 * Integration Tests for Tenant Code Migration Scenarios
 *
 * These tests cover real-world migration scenarios when upgrading
 * from a version without tenant code normalization to the current version.
 *
 * Migration Considerations:
 * 1. Existing DynamoDB data may have uppercase tenant codes in pk/sk
 * 2. RDS data may have uppercase tenantCode field values
 * 3. Cognito user attributes may have various case combinations
 * 4. Application code may be passing different case combinations
 */
describe('Tenant Code Migration Scenarios', () => {
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

  describe('Pre-migration data compatibility', () => {
    /**
     * IMPORTANT: This test documents a BREAKING CHANGE
     *
     * If existing data was stored with uppercase tenant codes in the pk,
     * the new normalization will cause queries to miss that data.
     *
     * Example:
     * - Old pk: 'TODO#MY_TENANT'
     * - New query generates pk: 'TODO#my_tenant'
     * - These don't match = data not found
     */
    it('should document breaking change for uppercase pk data', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'MY_TENANT', // User's Cognito has uppercase
        'custom:roles': JSON.stringify([]),
      })

      const userContext = getUserContext(ctx)

      // New code generates lowercase pk
      const newPk = `TODO#${userContext.tenantCode}`
      expect(newPk).toBe('TODO#my_tenant')

      // Old data would have uppercase pk
      const oldDataPk = 'TODO#MY_TENANT'

      // This demonstrates the incompatibility
      expect(newPk).not.toBe(oldDataPk)

      // MIGRATION REQUIRED:
      // Option 1: Update DynamoDB data to use lowercase tenant codes
      // Option 2: Update Cognito user attributes to use lowercase
      // Option 3: Implement custom adapter layer to handle both formats
    })

    it('should work correctly if Cognito was already lowercase', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'my_tenant', // Already lowercase
        'custom:roles': JSON.stringify([
          { tenant: 'my_tenant', role: 'admin' },
        ]),
      })

      const userContext = getUserContext(ctx)

      // No change needed
      expect(userContext.tenantCode).toBe('my_tenant')
      expect(userContext.tenantRole).toBe('admin')
    })
  })

  describe('Migration strategy: Cognito update approach', () => {
    /**
     * Migration Strategy 1: Update Cognito user attributes
     *
     * Steps:
     * 1. Update all users' custom:tenant attribute to lowercase
     * 2. Update all roles' tenant field to lowercase
     * 3. Deploy new code
     *
     * Pros: Clean approach, no data migration needed
     * Cons: Requires Cognito admin access, may affect active users
     */
    it('should handle user with migrated lowercase Cognito attributes', () => {
      // After migration: Cognito has lowercase
      const ctx = createMockContext({
        sub: 'migrated-user-123',
        'custom:tenant': 'company_abc', // Migrated to lowercase
        'custom:roles': JSON.stringify([
          { tenant: 'company_abc', role: 'admin' }, // Migrated to lowercase
        ]),
      })

      const userContext = getUserContext(ctx)

      expect(userContext.tenantCode).toBe('company_abc')
      expect(userContext.tenantRole).toBe('admin')
    })
  })

  describe('Migration strategy: Data migration approach', () => {
    /**
     * Migration Strategy 2: Migrate DynamoDB and RDS data
     *
     * Steps:
     * 1. Scan all DynamoDB tables for items with tenant codes in pk
     * 2. Create new items with lowercase pk, delete old items
     * 3. Update RDS tenantCode columns to lowercase
     * 4. Deploy new code
     *
     * Pros: Keeps Cognito unchanged
     * Cons: Complex data migration, downtime may be needed
     */
    it('should work with migrated lowercase DynamoDB data', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'COMPANY_ABC', // Cognito still uppercase
        'custom:roles': JSON.stringify([]),
      })

      const userContext = getUserContext(ctx)

      // New code normalizes to lowercase
      const pk = `TODO#${userContext.tenantCode}`
      expect(pk).toBe('TODO#company_abc')

      // Migrated DynamoDB data should also be lowercase
      const migratedDataPk = 'TODO#company_abc'
      expect(pk).toBe(migratedDataPk) // Now matches!
    })
  })

  describe('Migration strategy: Dual-write approach', () => {
    /**
     * Migration Strategy 3: Dual-write during transition period
     *
     * Steps:
     * 1. Deploy code that writes to BOTH old (uppercase) and new (lowercase) keys
     * 2. Read operations check both formats
     * 3. Run background job to migrate old data
     * 4. Remove dual-write logic after migration complete
     *
     * Pros: Zero downtime, gradual migration
     * Cons: More complex code, temporary increase in storage
     */
    it('should demonstrate dual-key lookup pattern', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'MY_TENANT',
        'custom:roles': JSON.stringify([]),
      })

      const userContext = getUserContext(ctx)

      // Function to generate both old and new format pks
      const generateDualPks = (
        prefix: string,
        tenantInput: string,
      ): { oldPk: string; newPk: string } => {
        const normalizedTenant = tenantInput.toLowerCase()
        return {
          oldPk: `${prefix}#${tenantInput}`, // Old format (original case)
          newPk: `${prefix}#${normalizedTenant}`, // New format (lowercase)
        }
      }

      // Note: This demonstrates the pattern, but actual implementation
      // would need the original tenant code before normalization
      const { oldPk, newPk } = generateDualPks('TODO', 'MY_TENANT')

      expect(oldPk).toBe('TODO#MY_TENANT')
      expect(newPk).toBe('TODO#my_tenant')

      // Dual-read would try newPk first, then oldPk as fallback
    })
  })

  describe('Cross-tenant access during migration', () => {
    it('should handle system admin accessing migrated and non-migrated tenants', () => {
      // System admin accessing various tenants during migration
      const testCases = [
        {
          headerTenant: 'MIGRATED_TENANT', // Will normalize to lowercase
          expectedPk: 'TODO#migrated_tenant',
        },
        {
          headerTenant: 'non_migrated_tenant', // Already lowercase
          expectedPk: 'TODO#non_migrated_tenant',
        },
        {
          headerTenant: 'Mixed_Case_Tenant',
          expectedPk: 'TODO#mixed_case_tenant',
        },
      ]

      for (const { headerTenant, expectedPk } of testCases) {
        const ctx = createMockContext(
          {
            sub: 'admin-123',
            'custom:roles': JSON.stringify([
              { tenant: '', role: ROLE_SYSTEM_ADMIN },
            ]),
          },
          { [HEADER_TENANT_CODE]: headerTenant },
        )

        const userContext = getUserContext(ctx)
        const pk = `TODO#${userContext.tenantCode}`

        expect(pk).toBe(expectedPk)
      }
    })
  })

  describe('Role matching during migration', () => {
    it('should handle mixed case roles during migration period', () => {
      // User has roles defined at different times with different conventions
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'Company_ABC',
        'custom:roles': JSON.stringify([
          // Pre-migration role (uppercase)
          { tenant: 'COMPANY_ABC', role: 'old_admin' },
          // Post-migration role (lowercase)
          { tenant: 'company_abc', role: 'new_admin' },
        ]),
      })

      const userContext = getUserContext(ctx)

      // Should find a matching role (first one that matches)
      expect(userContext.tenantCode).toBe('company_abc')
      expect(['old_admin', 'new_admin']).toContain(userContext.tenantRole)
    })

    it('should find role even if only old format exists', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'MY_COMPANY',
        'custom:roles': JSON.stringify([
          // Only old format role exists
          { tenant: 'MY_COMPANY', role: 'legacy_admin' },
        ]),
      })

      const userContext = getUserContext(ctx)

      // Normalization should still find the role
      expect(userContext.tenantCode).toBe('my_company')
      expect(userContext.tenantRole).toBe('legacy_admin')
    })
  })

  describe('Validation helpers for migration', () => {
    /**
     * Helper functions that could be used during migration
     * to validate and track migration progress
     */

    it('should detect tenant codes that need migration', () => {
      const needsMigration = (tenantCode: string): boolean => {
        return tenantCode !== tenantCode.toLowerCase()
      }

      expect(needsMigration('MY_TENANT')).toBe(true)
      expect(needsMigration('My_Tenant')).toBe(true)
      expect(needsMigration('my_tenant')).toBe(false)
      expect(needsMigration('mytenant')).toBe(false)
    })

    it('should normalize tenant code consistently', () => {
      const normalizeTenantCode = (tenantCode: string): string => {
        return tenantCode?.toLowerCase() || ''
      }

      expect(normalizeTenantCode('MY_TENANT')).toBe('my_tenant')
      expect(normalizeTenantCode('My_Tenant')).toBe('my_tenant')
      expect(normalizeTenantCode('my_tenant')).toBe('my_tenant')
      expect(normalizeTenantCode('')).toBe('')
      expect(normalizeTenantCode(undefined as any)).toBe('')
    })

    it('should generate migration-safe pk', () => {
      const generateMigrationSafePk = (
        prefix: string,
        tenantCode: string,
      ): string => {
        // Always use lowercase for new writes
        return `${prefix}#${tenantCode.toLowerCase()}`
      }

      expect(generateMigrationSafePk('TODO', 'MY_TENANT')).toBe('TODO#my_tenant')
      expect(generateMigrationSafePk('USER', 'Company_ABC')).toBe(
        'USER#company_abc',
      )
    })
  })

  describe('Post-migration verification', () => {
    it('should verify all tenant codes are normalized after migration', () => {
      // Simulating post-migration verification
      const verifyNormalized = (tenantCodes: string[]): boolean => {
        return tenantCodes.every((tc) => tc === tc.toLowerCase())
      }

      // After migration, all should be lowercase
      const migratedTenants = ['tenant_a', 'tenant_b', 'company_xyz']
      expect(verifyNormalized(migratedTenants)).toBe(true)

      // Before migration complete, might have mixed case
      const partiallyMigrated = ['tenant_a', 'TENANT_B', 'company_xyz']
      expect(verifyNormalized(partiallyMigrated)).toBe(false)
    })

    it('should verify getUserContext consistently returns lowercase', () => {
      // Test various inputs to ensure consistent output
      const testInputs = [
        'TENANT',
        'Tenant',
        'tenant',
        'TeNaNt',
        'TENANT_CODE',
        'tenant-code',
        'Tenant.Code',
      ]

      for (const input of testInputs) {
        const ctx = createMockContext({
          sub: 'user-123',
          'custom:tenant': input,
          'custom:roles': JSON.stringify([]),
        })

        const userContext = getUserContext(ctx)

        // All outputs should be lowercase
        expect(userContext.tenantCode).toBe(input.toLowerCase())
      }
    })
  })
})

describe('Tenant Code Regression Prevention', () => {
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

  describe('Regression tests for core functionality', () => {
    it('should not regress: basic tenant code extraction', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'tenant-a',
        'custom:roles': JSON.stringify([{ tenant: 'tenant-a', role: 'user' }]),
      })

      const result = getUserContext(ctx)

      expect(result.userId).toBe('user-123')
      expect(result.tenantCode).toBe('tenant-a')
      expect(result.tenantRole).toBe('user')
    })

    it('should not regress: header tenant code usage', () => {
      const ctx = createMockContext(
        {
          sub: 'user-123',
          'custom:roles': JSON.stringify([{ tenant: '', role: 'user' }]),
        },
        { [HEADER_TENANT_CODE]: 'header-tenant' },
      )

      const result = getUserContext(ctx)

      expect(result.tenantCode).toBe('header-tenant')
    })

    it('should not regress: system admin header override', () => {
      const ctx = createMockContext(
        {
          sub: 'admin-123',
          'custom:roles': JSON.stringify([
            { tenant: '', role: ROLE_SYSTEM_ADMIN },
          ]),
        },
        { [HEADER_TENANT_CODE]: 'any-tenant' },
      )

      const result = getUserContext(ctx)

      expect(result.tenantCode).toBe('any-tenant')
      expect(result.tenantRole).toBe(ROLE_SYSTEM_ADMIN)
    })

    it('should not regress: global role fallback', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'unknown-tenant',
        'custom:roles': JSON.stringify([
          { tenant: 'other-tenant', role: 'specific-role' },
          { tenant: '', role: 'global-role' },
        ]),
      })

      const result = getUserContext(ctx)

      expect(result.tenantRole).toBe('global-role')
    })

    it('should not regress: tenant-specific role priority', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'target-tenant',
        'custom:roles': JSON.stringify([
          { tenant: '', role: 'global-role' },
          { tenant: 'target-tenant', role: 'specific-role' },
        ]),
      })

      const result = getUserContext(ctx)

      expect(result.tenantRole).toBe('specific-role')
    })

    it('should not regress: custom:tenant takes priority over header', () => {
      const ctx = createMockContext(
        {
          sub: 'user-123',
          'custom:tenant': 'cognito-tenant',
          'custom:roles': JSON.stringify([]),
        },
        { [HEADER_TENANT_CODE]: 'header-tenant' },
      )

      const result = getUserContext(ctx)

      expect(result.tenantCode).toBe('cognito-tenant')
    })

    it('should not regress: empty roles handling', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'tenant-a',
        'custom:roles': '[]',
      })

      const result = getUserContext(ctx)

      expect(result.tenantCode).toBe('tenant-a')
      expect(result.tenantRole).toBe('')
    })

    it('should not regress: missing roles handling', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'tenant-a',
      })

      const result = getUserContext(ctx)

      expect(result.tenantCode).toBe('tenant-a')
      expect(result.tenantRole).toBe('')
    })
  })

  describe('Regression tests for normalization', () => {
    it('should always normalize tenantCode to lowercase', () => {
      const testCases = [
        { input: 'UPPERCASE', expected: 'uppercase' },
        { input: 'lowercase', expected: 'lowercase' },
        { input: 'MixedCase', expected: 'mixedcase' },
        { input: 'SNAKE_CASE', expected: 'snake_case' },
        { input: 'kebab-case', expected: 'kebab-case' },
        { input: 'PascalCase', expected: 'pascalcase' },
        { input: 'camelCase', expected: 'camelcase' },
        { input: '123Numbers', expected: '123numbers' },
        { input: 'Special-_Chars', expected: 'special-_chars' },
      ]

      for (const { input, expected } of testCases) {
        const ctx = createMockContext({
          sub: 'user-123',
          'custom:tenant': input,
          'custom:roles': JSON.stringify([]),
        })

        const result = getUserContext(ctx)

        expect(result.tenantCode).toBe(expected)
      }
    })

    it('should normalize role tenant matching', () => {
      const ctx = createMockContext({
        sub: 'user-123',
        'custom:tenant': 'TenantA',
        'custom:roles': JSON.stringify([
          { tenant: 'TENANTA', role: 'role-from-uppercase' },
        ]),
      })

      const result = getUserContext(ctx)

      // Role should be found despite case mismatch
      expect(result.tenantRole).toBe('role-from-uppercase')
    })
  })
})
