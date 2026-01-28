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
 */
import { createMock } from '@golevelup/ts-jest'
import { ExecutionContext } from '@nestjs/common'
import { RolesGuard } from './roles.guard'
import { Reflector } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { ROLE_METADATA } from '../decorators'
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

  /** Non-system-admin cannot override tenant via header */
  it('should return false if non-system-admin tries to use header tenant', async () => {
    // Arrange - user without custom:tenant trying to use header
    const userWithoutTenantClaims = {
      sub: '12345678-1234-1234-1234-123456789012',
      'cognito:username': 'user1',
      email: 'user@test.com',
      'custom:roles': JSON.stringify([{ role: 'user' }]),
      // No custom:tenant - should NOT be able to use header
    }
    mockJwtDecode.mockReturnValue(userWithoutTenantClaims)
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['user'])
    ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
      createRequestStub('attempted-tenant'),
    )
    // Act & Assert - should fail because non-admin cannot use header tenant
    expect(await rolesGuard.canActivate(execution_context)).toBeFalsy()
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
})
