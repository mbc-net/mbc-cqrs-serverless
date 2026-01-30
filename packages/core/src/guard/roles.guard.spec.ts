/**
 * RolesGuard Test Suite
 *
 * Tests role-based access control (RBAC) guard functionality.
 * The guard validates JWT tokens and checks user roles against required roles.
 *
 * Key behaviors tested:
 * - Tenant code validation (required for all requests)
 * - Role matching against @Roles() decorator requirements
 * - JWT token parsing for role extraction
 * - System admin can override tenant via header (when no custom:tenant)
 * - Regular users require custom:tenant in Cognito (cannot use header override)
 * - Common tenant access allowed for all users via header
 */
import { createMock } from '@golevelup/ts-jest'
import { ExecutionContext } from '@nestjs/common'
import { RolesGuard } from './roles.guard'
import { Reflector } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { ROLE_METADATA } from '../decorators'
import { UserContext } from '../context'
import * as jwtDecode from 'jwt-decode'

// Mock jwt-decode to control claims in tests
jest.mock('jwt-decode', () => ({
  jwtDecode: jest.fn(),
}))

const mockJwtDecode = jwtDecode.jwtDecode as jest.Mock

// Dummy token (actual decoding is mocked)
const dummyToken = 'dummy.jwt.token'

// Claims for system admin (global admin with no tenant)
const systemAdminClaims = {
  sub: '92ca4f68-9ac6-4080-9ae2-2f02a86206a4',
  'cognito:username': 'admin',
  email: 'admin@test.com',
  'custom:roles': JSON.stringify([{ role: 'system_admin' }]),
  // No custom:tenant - system admin uses header
}

// Claims for regular user with tenant
const tenantUserClaims = {
  sub: '12345678-1234-1234-1234-123456789012',
  'cognito:username': 'user1',
  email: 'user@test.com',
  'custom:tenant': 'test',
  'custom:roles': JSON.stringify([{ tenant: 'test', role: 'user' }]),
}

// Claims for regular user without tenant (no custom:tenant, not system admin)
const userWithoutTenantClaims = {
  sub: '12345678-1234-1234-1234-123456789012',
  'cognito:username': 'user1',
  email: 'user@test.com',
  'custom:roles': JSON.stringify([{ role: 'user' }]),
  // No custom:tenant
}

const createRequestStub = (tenantCode = 'test') => ({
  headers: {
    'x-tenant-code': tenantCode,
  },
  get: () => dummyToken,
})

const execution_context: ExecutionContext = createMock<ExecutionContext>({
  getHandler: jest.fn(),
  getClass: jest.fn(),
  switchToHttp: jest.fn().mockReturnValue({
    getRequest: jest.fn(),
  }),
})

describe('RolesGuard', () => {
  let rolesGuard: RolesGuard
  let reflector: Reflector

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [RolesGuard],
    }).compile()
    rolesGuard = moduleRef.get<RolesGuard>(RolesGuard)
    reflector = moduleRef.get<Reflector>(Reflector)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('tenant validation', () => {
    /** Rejects request when x-tenant-code header is missing or empty */
    it('should return false if tenant code does not exist', async () => {
      // Arrange
      mockJwtDecode.mockReturnValue(systemAdminClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['system_admin'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub(''),
      )
      // Act & Assert
      expect(await rolesGuard.canActivate(execution_context)).toBeFalsy()
      expect(reflector.getAllAndOverride).toHaveBeenCalledTimes(0)
    })

    /** User with custom:tenant can access their own tenant */
    it('should allow user with custom:tenant to access', async () => {
      // Arrange
      mockJwtDecode.mockReturnValue(tenantUserClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['user'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('test'),
      )
      // Act & Assert
      expect(await rolesGuard.canActivate(execution_context)).toBeTruthy()
    })

    /** System admin can use header to specify tenant */
    it('should allow system admin to override tenant via header', async () => {
      // Arrange
      mockJwtDecode.mockReturnValue(systemAdminClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['system_admin'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('any-tenant'),
      )
      // Act & Assert - system admin should be able to access any tenant via header
      expect(await rolesGuard.canActivate(execution_context)).toBeTruthy()
    })

    /** Non-system-admin cannot override tenant via header */
    it('should return false if non-system-admin tries to use header tenant', async () => {
      // Arrange - user without custom:tenant trying to use header
      mockJwtDecode.mockReturnValue(userWithoutTenantClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['user'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('attempted-tenant'),
      )
      // Act & Assert - should fail because non-admin cannot use header tenant
      expect(await rolesGuard.canActivate(execution_context)).toBeFalsy()
    })

    /** Common tenant should be accessible by anyone via header */
    it('should allow access to common tenant via header', async () => {
      // Arrange - user without custom:tenant accessing common tenant
      mockJwtDecode.mockReturnValue(userWithoutTenantClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['user'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('common'),
      )
      // Act & Assert - common tenant should be accessible
      expect(await rolesGuard.canActivate(execution_context)).toBeTruthy()
    })

    /** Custom:tenant takes priority over header */
    it('should use custom:tenant when present, ignoring header', async () => {
      // Arrange - user with custom:tenant, different header value
      const claimsWithTenant = {
        ...userWithoutTenantClaims,
        'custom:tenant': 'my-tenant',
        'custom:roles': JSON.stringify([{ tenant: 'my-tenant', role: 'admin' }]),
      }
      mockJwtDecode.mockReturnValue(claimsWithTenant)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('other-tenant'),
      )
      // Act & Assert - should use custom:tenant, not header
      expect(await rolesGuard.canActivate(execution_context)).toBeTruthy()
    })
  })

  describe('role validation', () => {
    /** Grants access when user's role matches required role */
    it('should return true if the user has the system admin role', async () => {
      // Arrange
      mockJwtDecode.mockReturnValue(systemAdminClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['system_admin'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub(),
      )
      // Act & Assert
      expect(await rolesGuard.canActivate(execution_context)).toBeTruthy()
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLE_METADATA, [
        execution_context.getHandler(),
        execution_context.getClass(),
      ])
    })

    /** Grants access when user has one of multiple allowed roles */
    it('should return true if the user has the user role', async () => {
      // Arrange
      mockJwtDecode.mockReturnValue(tenantUserClaims)
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['system_admin', 'user'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub(),
      )
      // Act & Assert
      expect(await rolesGuard.canActivate(execution_context)).toBeTruthy()
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLE_METADATA, [
        execution_context.getHandler(),
        execution_context.getClass(),
      ])
    })

    /** Denies access when user's role is not in the required roles list */
    it('should return false if the user has only the user role', async () => {
      // Arrange
      mockJwtDecode.mockReturnValue(tenantUserClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['system_admin'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub(),
      )
      // Act & Assert
      expect(await rolesGuard.canActivate(execution_context)).toBeFalsy()
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLE_METADATA, [
        execution_context.getHandler(),
        execution_context.getClass(),
      ])
    })

    /** System admin can access any role-protected endpoint */
    it('should allow system admin to access any role', async () => {
      // Arrange
      mockJwtDecode.mockReturnValue(systemAdminClaims)
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(['specific_role_only'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub(),
      )
      // Act & Assert
      expect(await rolesGuard.canActivate(execution_context)).toBeTruthy()
    })

    /** No role requirement means all authenticated users can access */
    it('should return true if no roles are required', async () => {
      // Arrange
      mockJwtDecode.mockReturnValue(tenantUserClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined)
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub(),
      )
      // Act & Assert
      expect(await rolesGuard.canActivate(execution_context)).toBeTruthy()
    })

    it('should return true if roles array is empty', async () => {
      // Arrange
      mockJwtDecode.mockReturnValue(tenantUserClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub(),
      )
      // Act & Assert
      expect(await rolesGuard.canActivate(execution_context)).toBeTruthy()
    })
  })

  describe('security scenarios', () => {
    /** Tenant-specific system admin should NOT be able to access other tenants */
    it('should reject tenant-specific system admin accessing other tenant', async () => {
      // Arrange - user is system_admin for tenant-a only
      const tenantSpecificAdminClaims = {
        sub: '12345678-1234-1234-1234-123456789012',
        'cognito:username': 'tenant-admin',
        email: 'admin@test.com',
        'custom:roles': JSON.stringify([
          { tenant: 'tenant-a', role: 'system_admin' },
        ]),
        // No custom:tenant - trying to use header
      }
      mockJwtDecode.mockReturnValue(tenantSpecificAdminClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['system_admin'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('tenant-b'),
      )
      // Act & Assert - tenant-specific admin should NOT access other tenants
      expect(await rolesGuard.canActivate(execution_context)).toBeFalsy()
    })

    /** Global system admin (empty tenant) CAN access any tenant */
    it('should allow global system admin to access any tenant', async () => {
      // Arrange - user is global system_admin
      const globalAdminClaims = {
        sub: '12345678-1234-1234-1234-123456789012',
        'cognito:username': 'global-admin',
        email: 'admin@test.com',
        'custom:roles': JSON.stringify([{ tenant: '', role: 'system_admin' }]),
        // No custom:tenant - using header
      }
      mockJwtDecode.mockReturnValue(globalAdminClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['system_admin'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('any-tenant'),
      )
      // Act & Assert - global admin should access any tenant
      expect(await rolesGuard.canActivate(execution_context)).toBeTruthy()
    })

    /** Regular user with empty role should not bypass checks */
    it('should reject user with empty role trying to access via header', async () => {
      // Arrange
      const emptyRoleClaims = {
        sub: '12345678-1234-1234-1234-123456789012',
        'cognito:username': 'user',
        email: 'user@test.com',
        'custom:roles': JSON.stringify([{ tenant: '', role: '' }]),
      }
      mockJwtDecode.mockReturnValue(emptyRoleClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['user'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('any-tenant'),
      )
      // Act & Assert - empty role should not grant cross-tenant access
      expect(await rolesGuard.canActivate(execution_context)).toBeFalsy()
    })

    /** Case sensitivity check for system_admin role */
    it('should be case-sensitive for role matching', async () => {
      // Arrange - uppercase SYSTEM_ADMIN should not match
      const uppercaseAdminClaims = {
        sub: '12345678-1234-1234-1234-123456789012',
        'cognito:username': 'admin',
        email: 'admin@test.com',
        'custom:roles': JSON.stringify([{ tenant: '', role: 'SYSTEM_ADMIN' }]),
      }
      mockJwtDecode.mockReturnValue(uppercaseAdminClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['system_admin'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('any-tenant'),
      )
      // Act & Assert - SYSTEM_ADMIN != system_admin, should fail cross-tenant
      expect(await rolesGuard.canActivate(execution_context)).toBeFalsy()
    })

    /** Common tenant code should be case-insensitive (tenantCode is normalized to lowercase) */
    it('should be case-insensitive for common tenant matching', async () => {
      // Arrange - 'COMMON' should match 'common' because tenantCode is normalized
      mockJwtDecode.mockReturnValue(userWithoutTenantClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['user'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('COMMON'),
      )
      // Act & Assert - 'COMMON' is normalized to 'common', should succeed
      expect(await rolesGuard.canActivate(execution_context)).toBeTruthy()
    })

    /** User with custom:tenant should not be affected by header override checks */
    it('should bypass header override check when user has custom:tenant', async () => {
      // Arrange - user has custom:tenant, header is different but should be ignored
      const claimsWithTenant = {
        sub: '12345678-1234-1234-1234-123456789012',
        'cognito:username': 'user',
        email: 'user@test.com',
        'custom:tenant': 'my-tenant',
        'custom:roles': JSON.stringify([{ tenant: 'my-tenant', role: 'user' }]),
      }
      mockJwtDecode.mockReturnValue(claimsWithTenant)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['user'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('attacker-tenant'), // malicious header should be ignored
      )
      // Act & Assert - should succeed because custom:tenant exists
      expect(await rolesGuard.canActivate(execution_context)).toBeTruthy()
    })

    /** Multiple roles with mixed tenant scopes */
    it('should correctly handle user with multiple roles including cross-tenant role', async () => {
      // Arrange - user has multiple roles, one of which is global system_admin
      const mixedRolesClaims = {
        sub: '12345678-1234-1234-1234-123456789012',
        'cognito:username': 'multi-role-user',
        email: 'user@test.com',
        'custom:roles': JSON.stringify([
          { tenant: 'tenant-a', role: 'user' },
          { tenant: '', role: 'system_admin' },
        ]),
        // No custom:tenant
      }
      mockJwtDecode.mockReturnValue(mixedRolesClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['system_admin'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('any-tenant'),
      )
      // Act & Assert - should succeed because global system_admin role exists
      expect(await rolesGuard.canActivate(execution_context)).toBeTruthy()
    })

    /** Whitespace in role name should not match */
    it('should not match role with whitespace', async () => {
      // Arrange - role with leading/trailing whitespace
      const whitespaceRoleClaims = {
        sub: '12345678-1234-1234-1234-123456789012',
        'cognito:username': 'user',
        email: 'user@test.com',
        'custom:roles': JSON.stringify([{ tenant: '', role: ' system_admin ' }]),
      }
      mockJwtDecode.mockReturnValue(whitespaceRoleClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['system_admin'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('any-tenant'),
      )
      // Act & Assert - ' system_admin ' != 'system_admin', should fail
      expect(await rolesGuard.canActivate(execution_context)).toBeFalsy()
    })

    /** User without any role should be rejected */
    it('should reject user with no role for cross-tenant access', async () => {
      // Arrange - user with empty roles array
      const noRoleClaims = {
        sub: '12345678-1234-1234-1234-123456789012',
        'cognito:username': 'user',
        email: 'user@test.com',
        'custom:roles': '[]',
      }
      mockJwtDecode.mockReturnValue(noRoleClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('any-tenant'),
      )
      // Act & Assert - no cross-tenant role, should fail header override
      expect(await rolesGuard.canActivate(execution_context)).toBeFalsy()
    })
  })

  describe('backward compatibility', () => {
    /** Verify RolesGuard constructor signature remains unchanged */
    it('should only require Reflector in constructor', async () => {
      // Verify we can create RolesGuard with just Reflector (backward compatible)
      const testReflector = new Reflector()
      const guard = new RolesGuard(testReflector)
      expect(guard).toBeInstanceOf(RolesGuard)
    })

    /** Verify existing behavior for users with custom:tenant */
    it('should maintain existing behavior for users with custom:tenant', async () => {
      // This is the most common case - user bound to tenant via Cognito
      mockJwtDecode.mockReturnValue(tenantUserClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['user'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('test'),
      )
      // Act & Assert - should work exactly as before
      expect(await rolesGuard.canActivate(execution_context)).toBeTruthy()
    })

    /** Verify existing behavior for system admin */
    it('should maintain existing behavior for system admin header override', async () => {
      // System admin using header - this should work as before
      mockJwtDecode.mockReturnValue(systemAdminClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['system_admin'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('any-tenant'),
      )
      // Act & Assert - should work exactly as before
      expect(await rolesGuard.canActivate(execution_context)).toBeTruthy()
    })

    /** Verify default common tenant is 'common' */
    it('should default to common tenant code', async () => {
      // User accessing 'common' tenant without custom:tenant should work
      mockJwtDecode.mockReturnValue(userWithoutTenantClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['user'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('common'),
      )
      // Act & Assert - 'common' is the default common tenant
      expect(await rolesGuard.canActivate(execution_context)).toBeTruthy()
    })

    /** Verify default cross-tenant role is 'system_admin' */
    it('should default to system_admin as cross-tenant role', async () => {
      // System admin should have cross-tenant access by default
      mockJwtDecode.mockReturnValue(systemAdminClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['system_admin'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('any-tenant'),
      )
      // Act & Assert
      expect(await rolesGuard.canActivate(execution_context)).toBeTruthy()

      // Other roles should not have cross-tenant access
      const managerClaims = {
        ...userWithoutTenantClaims,
        'custom:roles': JSON.stringify([{ tenant: '', role: 'manager' }]),
      }
      mockJwtDecode.mockReturnValue(managerClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['manager'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('any-tenant'),
      )
      expect(await rolesGuard.canActivate(execution_context)).toBeFalsy()
    })
  })

  describe('extensibility', () => {
    /** Subclass can customize common tenant codes */
    it('should allow subclass to override getCommonTenantCodes', async () => {
      // Create a custom RolesGuard that adds 'shared' as common tenant
      class CustomRolesGuard extends RolesGuard {
        protected getCommonTenantCodes(): string[] {
          return ['common', 'shared', 'public']
        }
      }

      const moduleRef = await Test.createTestingModule({
        providers: [
          CustomRolesGuard,
          {
            provide: Reflector,
            useValue: reflector,
          },
        ],
      }).compile()
      const customGuard = moduleRef.get<CustomRolesGuard>(CustomRolesGuard)

      // Arrange - user without custom:tenant accessing 'shared' tenant
      mockJwtDecode.mockReturnValue(userWithoutTenantClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['user'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('shared'),
      )

      // Act & Assert - 'shared' should be accessible
      expect(await customGuard.canActivate(execution_context)).toBeTruthy()
    })

    /** Subclass can customize cross-tenant roles */
    it('should allow subclass to override getCrossTenantRoles', async () => {
      // Create a custom RolesGuard that adds 'general_manager' as cross-tenant role
      class CustomRolesGuard extends RolesGuard {
        protected getCrossTenantRoles(): string[] {
          return ['system_admin', 'general_manager']
        }
      }

      const moduleRef = await Test.createTestingModule({
        providers: [
          CustomRolesGuard,
          {
            provide: Reflector,
            useValue: reflector,
          },
        ],
      }).compile()
      const customGuard = moduleRef.get<CustomRolesGuard>(CustomRolesGuard)

      // Arrange - general_manager without custom:tenant accessing any tenant
      const generalManagerClaims = {
        sub: '12345678-1234-1234-1234-123456789012',
        'cognito:username': 'manager',
        email: 'manager@test.com',
        'custom:roles': JSON.stringify([{ tenant: '', role: 'general_manager' }]),
      }
      mockJwtDecode.mockReturnValue(generalManagerClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['general_manager'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('any-tenant'),
      )

      // Act & Assert - general_manager should have cross-tenant access
      expect(await customGuard.canActivate(execution_context)).toBeTruthy()
    })

    /** Subclass can customize canOverrideTenant logic */
    it('should allow subclass to override canOverrideTenant', async () => {
      // Create a custom RolesGuard with additional logic
      class CustomRolesGuard extends RolesGuard {
        protected canOverrideTenant(
          context: ExecutionContext,
          userContext: UserContext,
        ): boolean {
          // Allow 'supervisor' role to access specific tenant patterns
          if (
            userContext.tenantRole === 'supervisor' &&
            userContext.tenantCode.startsWith('dept-')
          ) {
            return true
          }
          return super.canOverrideTenant(context, userContext)
        }
      }

      const moduleRef = await Test.createTestingModule({
        providers: [
          CustomRolesGuard,
          {
            provide: Reflector,
            useValue: reflector,
          },
        ],
      }).compile()
      const customGuard = moduleRef.get<CustomRolesGuard>(CustomRolesGuard)

      // Arrange - supervisor accessing dept- prefixed tenant
      const supervisorClaims = {
        sub: '12345678-1234-1234-1234-123456789012',
        'cognito:username': 'supervisor',
        email: 'supervisor@test.com',
        'custom:roles': JSON.stringify([{ tenant: '', role: 'supervisor' }]),
      }
      mockJwtDecode.mockReturnValue(supervisorClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['supervisor'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('dept-sales'),
      )

      // Act & Assert - supervisor should access dept- tenants
      expect(await customGuard.canActivate(execution_context)).toBeTruthy()

      // But not other tenants
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('other-tenant'),
      )
      expect(await customGuard.canActivate(execution_context)).toBeFalsy()
    })

    /** Subclass can customize isHeaderOverride logic */
    it('should allow subclass to override isHeaderOverride', async () => {
      // Create a custom RolesGuard that treats certain claim patterns as non-header-override
      class CustomRolesGuard extends RolesGuard {
        protected isHeaderOverride(
          context: ExecutionContext,
          userContext: UserContext,
        ): boolean {
          // Treat users with special:access claim as not header override
          const claims = this.getAuthorizerClaims(context)
          if (claims['special:access'] === 'allowed') {
            return false
          }
          return super.isHeaderOverride(context, userContext)
        }
      }

      const moduleRef = await Test.createTestingModule({
        providers: [
          CustomRolesGuard,
          {
            provide: Reflector,
            useValue: reflector,
          },
        ],
      }).compile()
      const customGuard = moduleRef.get<CustomRolesGuard>(CustomRolesGuard)

      // Arrange - user with special:access claim
      const specialAccessClaims = {
        sub: '12345678-1234-1234-1234-123456789012',
        'cognito:username': 'special-user',
        email: 'special@test.com',
        'custom:roles': JSON.stringify([{ tenant: '', role: 'user' }]),
        'special:access': 'allowed',
        // No custom:tenant
      }
      mockJwtDecode.mockReturnValue(specialAccessClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['user'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('any-tenant'),
      )

      // Act & Assert - special access bypasses header override check
      expect(await customGuard.canActivate(execution_context)).toBeTruthy()
    })

    /** Subclass can return empty common tenant list */
    it('should handle empty common tenant list from subclass', async () => {
      // Create a custom RolesGuard with no common tenants
      class CustomRolesGuard extends RolesGuard {
        protected getCommonTenantCodes(): string[] {
          return [] // No common tenants allowed
        }
      }

      const moduleRef = await Test.createTestingModule({
        providers: [
          CustomRolesGuard,
          {
            provide: Reflector,
            useValue: reflector,
          },
        ],
      }).compile()
      const customGuard = moduleRef.get<CustomRolesGuard>(CustomRolesGuard)

      // Arrange - user trying to access 'common' tenant
      mockJwtDecode.mockReturnValue(userWithoutTenantClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['user'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('common'),
      )

      // Act & Assert - 'common' should no longer be accessible
      expect(await customGuard.canActivate(execution_context)).toBeFalsy()
    })

    /** Subclass can return empty cross-tenant roles list */
    it('should handle empty cross-tenant roles list from subclass', async () => {
      // Create a custom RolesGuard with no cross-tenant roles
      class CustomRolesGuard extends RolesGuard {
        protected getCrossTenantRoles(): string[] {
          return [] // No cross-tenant roles allowed
        }
      }

      const moduleRef = await Test.createTestingModule({
        providers: [
          CustomRolesGuard,
          {
            provide: Reflector,
            useValue: reflector,
          },
        ],
      }).compile()
      const customGuard = moduleRef.get<CustomRolesGuard>(CustomRolesGuard)

      // Arrange - system admin trying to access via header
      mockJwtDecode.mockReturnValue(systemAdminClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['system_admin'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('any-tenant'),
      )

      // Act & Assert - even system_admin should not have cross-tenant access
      expect(await customGuard.canActivate(execution_context)).toBeFalsy()

      // But common tenant should still work (common tenant check comes first)
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('common'),
      )
      expect(await customGuard.canActivate(execution_context)).toBeTruthy()
    })

    /** Subclass can inject ConfigService and read from environment */
    it('should demonstrate ConfigService integration pattern', async () => {
      // This test demonstrates how apps can integrate with ConfigService
      const mockConfigService = {
        get: jest.fn((key: string, defaultValue: string) => {
          if (key === 'COMMON_TENANT_CODES') return 'common,shared,global'
          if (key === 'CROSS_TENANT_ROLES') return 'system_admin,super_admin'
          return defaultValue
        }),
      }

      class ConfigurableRolesGuard extends RolesGuard {
        constructor(
          reflector: Reflector,
          private configService: typeof mockConfigService,
        ) {
          super(reflector)
        }

        protected getCommonTenantCodes(): string[] {
          const codes = this.configService.get('COMMON_TENANT_CODES', 'common')
          return codes.split(',').map((c: string) => c.trim())
        }

        protected getCrossTenantRoles(): string[] {
          const roles = this.configService.get('CROSS_TENANT_ROLES', 'system_admin')
          return roles.split(',').map((r: string) => r.trim())
        }
      }

      const guard = new ConfigurableRolesGuard(reflector, mockConfigService)

      // Arrange - user accessing 'shared' tenant (configured as common)
      mockJwtDecode.mockReturnValue(userWithoutTenantClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['user'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('shared'),
      )

      // Act & Assert - 'shared' should be accessible via config
      expect(await guard.canActivate(execution_context)).toBeTruthy()

      // Also verify 'global' works
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('global'),
      )
      expect(await guard.canActivate(execution_context)).toBeTruthy()
    })
  })

  describe('edge cases and integration', () => {
    /** Verify both tenant and role checks are performed in sequence */
    it('should check tenant first, then role', async () => {
      // Arrange - valid tenant but wrong role
      mockJwtDecode.mockReturnValue(tenantUserClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']) // user has 'user' role
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('test'),
      )

      // Act & Assert - should fail on role check (tenant passes)
      expect(await rolesGuard.canActivate(execution_context)).toBeFalsy()
      // Verify reflector was called (means tenant check passed)
      expect(reflector.getAllAndOverride).toHaveBeenCalled()
    })

    /** Verify tenant check failure prevents role check */
    it('should not check role when tenant check fails', async () => {
      // Arrange - invalid tenant access
      mockJwtDecode.mockReturnValue(userWithoutTenantClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['user'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('unauthorized-tenant'),
      )

      // Act & Assert
      expect(await rolesGuard.canActivate(execution_context)).toBeFalsy()
      // Verify reflector was NOT called (tenant check failed first)
      expect(reflector.getAllAndOverride).not.toHaveBeenCalled()
    })

    /** Handle undefined tenantRole in cross-tenant check */
    it('should handle undefined tenantRole safely', async () => {
      // Arrange - user with no roles at all
      const noRolesClaims = {
        sub: '12345678-1234-1234-1234-123456789012',
        'cognito:username': 'user',
        email: 'user@test.com',
        'custom:roles': '[]', // empty roles array
      }
      mockJwtDecode.mockReturnValue(noRolesClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('any-tenant'),
      )

      // Act & Assert - should not throw, should return false
      expect(await rolesGuard.canActivate(execution_context)).toBeFalsy()
    })

    /** Tenant code case - header vs common tenant (case-insensitive) */
    it('should be case-insensitive when matching header tenant to common tenants', async () => {
      // 'Common' (capital C) should match 'common' because tenantCode is normalized
      mockJwtDecode.mockReturnValue(userWithoutTenantClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['user'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('Common'),
      )

      // Both 'Common' and 'common' should work (normalized to lowercase)
      expect(await rolesGuard.canActivate(execution_context)).toBeTruthy()

      // 'common' should also work
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('common'),
      )
      expect(await rolesGuard.canActivate(execution_context)).toBeTruthy()
    })

    /** User with custom:tenant accessing their own tenant with mismatched header */
    it('should allow access when custom:tenant matches even with different header', async () => {
      // User has custom:tenant='test', header says 'other-tenant'
      // Should use custom:tenant and succeed
      mockJwtDecode.mockReturnValue(tenantUserClaims) // custom:tenant = 'test'
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['user'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('other-tenant'), // header says different tenant
      )

      // Act & Assert - should succeed because custom:tenant is used
      expect(await rolesGuard.canActivate(execution_context)).toBeTruthy()
    })

    /** System admin with custom:tenant should use custom:tenant, not header */
    it('should use custom:tenant for system admin when present', async () => {
      // System admin with custom:tenant should be bound to that tenant
      const systemAdminWithTenant = {
        sub: '12345678-1234-1234-1234-123456789012',
        'cognito:username': 'admin',
        email: 'admin@test.com',
        'custom:tenant': 'admin-tenant',
        'custom:roles': JSON.stringify([{ tenant: '', role: 'system_admin' }]),
      }
      mockJwtDecode.mockReturnValue(systemAdminWithTenant)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['system_admin'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('other-tenant'),
      )

      // Act & Assert - should succeed, using custom:tenant (not header)
      expect(await rolesGuard.canActivate(execution_context)).toBeTruthy()
    })

    /** Verify getAuthorizerClaims helper works correctly */
    it('should expose getAuthorizerClaims for subclass use', async () => {
      // Create a subclass that uses getAuthorizerClaims
      class TestableRolesGuard extends RolesGuard {
        public testGetClaims(context: ExecutionContext) {
          return this.getAuthorizerClaims(context)
        }
      }

      const moduleRef = await Test.createTestingModule({
        providers: [
          TestableRolesGuard,
          {
            provide: Reflector,
            useValue: reflector,
          },
        ],
      }).compile()
      const testableGuard = moduleRef.get<TestableRolesGuard>(TestableRolesGuard)

      mockJwtDecode.mockReturnValue(tenantUserClaims)
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('test'),
      )

      const claims = testableGuard.testGetClaims(execution_context)
      expect(claims['custom:tenant']).toBe('test')
      expect(claims.sub).toBe('12345678-1234-1234-1234-123456789012')
    })

    /** Falsy tenantCode values should be rejected */
    it('should reject falsy tenantCode values', async () => {
      // Test various falsy values
      const falsyTenantTests = [
        { header: '', description: 'empty string' },
        { header: undefined as unknown as string, description: 'undefined' },
      ]

      for (const { header, description } of falsyTenantTests) {
        mockJwtDecode.mockReturnValue(userWithoutTenantClaims)
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['user'])
        ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue({
          headers: { 'x-tenant-code': header },
          get: () => dummyToken,
        })

        expect(await rolesGuard.canActivate(execution_context)).toBeFalsy()
      }
    })

    /** Multiple common tenants scenario */
    it('should work with subclass returning multiple common tenants', async () => {
      class MultiCommonRolesGuard extends RolesGuard {
        protected getCommonTenantCodes(): string[] {
          return ['common', 'public', 'shared']
        }
      }

      const moduleRef = await Test.createTestingModule({
        providers: [
          MultiCommonRolesGuard,
          {
            provide: Reflector,
            useValue: reflector,
          },
        ],
      }).compile()
      const multiGuard = moduleRef.get<MultiCommonRolesGuard>(MultiCommonRolesGuard)

      mockJwtDecode.mockReturnValue(userWithoutTenantClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['user'])

      // All three should work
      for (const tenant of ['common', 'public', 'shared']) {
        ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
          createRequestStub(tenant),
        )
        expect(await multiGuard.canActivate(execution_context)).toBeTruthy()
      }

      // But others should not
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('private'),
      )
      expect(await multiGuard.canActivate(execution_context)).toBeFalsy()
    })

    /** Verify verifyTenant and verifyRole are async (for subclass override) */
    it('should support async overrides of verifyTenant and verifyRole', async () => {
      class AsyncRolesGuard extends RolesGuard {
        protected async verifyTenant(context: ExecutionContext): Promise<boolean> {
          // Simulate async operation
          await new Promise((resolve) => setTimeout(resolve, 1))
          return super.verifyTenant(context)
        }

        protected async verifyRole(context: ExecutionContext): Promise<boolean> {
          // Simulate async operation
          await new Promise((resolve) => setTimeout(resolve, 1))
          return super.verifyRole(context)
        }
      }

      const moduleRef = await Test.createTestingModule({
        providers: [
          AsyncRolesGuard,
          {
            provide: Reflector,
            useValue: reflector,
          },
        ],
      }).compile()
      const asyncGuard = moduleRef.get<AsyncRolesGuard>(AsyncRolesGuard)

      mockJwtDecode.mockReturnValue(tenantUserClaims)
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['user'])
      ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
        createRequestStub('test'),
      )

      // Should work with async overrides
      expect(await asyncGuard.canActivate(execution_context)).toBeTruthy()
    })
  })
})
