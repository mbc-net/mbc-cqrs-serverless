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
 *
 * Test tokens used:
 * - systemAdminToken: Contains role "system_admin"
 * - userToken: Contains role "user"
 */
import { createMock } from '@golevelup/ts-jest'
import { ExecutionContext } from '@nestjs/common'
import { RolesGuard } from './roles.guard'
import { Reflector } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { ROLE_METADATA } from '../decorators'

const systemAdminToken =
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IkNvZ25pdG9Mb2NhbCJ9.eyJjb2duaXRvOnVzZXJuYW1lIjoiYWRtaW4yIiwiYXV0aF90aW1lIjoxNzI1NTMyNzk3LCJlbWFpbCI6ImFkbWluQHRlc3QuY29tIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJldmVudF9pZCI6IjExNzY4NjljLTJiYjAtNDE3ZC1iMWI5LWI4YjJiMjBmNzRjNCIsImlhdCI6MTcyNTUzMjc5NywianRpIjoiMGYwY2NkMjItZTliNi00YTkzLWI0MDUtMDA5ODg4YWJlNTBkIiwic3ViIjoiOTJjYTRmNjgtOWFjNi00MDgwLTlhZTItMmYwMmE4NjIwNmE0IiwidG9rZW5fdXNlIjoiaWQiLCJjdXN0b206cm9sZXMiOiJbe1wicm9sZVwiOlwic3lzdGVtX2FkbWluXCJ9XSIsImV4cCI6MTcyNTYxOTE5NywiYXVkIjoiZG5rOHk3aWkzd2xlZDM1cDNsdzBsMmNkNyIsImlzcyI6Imh0dHA6Ly9sb2NhbGhvc3Q6OTIyOS9sb2NhbF8yRzdub0hnVyJ9.g3s5U8GyahEkVKZ-DmGc8_bfrN0Dq0FOAZnpic1vEXXQbi0tE8dsDAQZc3IyWwuZRmdQcbjAA7jTXQUM5enDAG2uFY5DWSJg_fzVNMJ9-fCuUmG-ZnoZWuM6J4nlvhgUYktEB5Y3sEpj5JjWH6jJfTvX_QDfLLXGkWU_Mm7EAvu8eHXdwsrnI3sJfwE5gGOzp_s9bucpzgF7DEbQnf15fGwot8RrMhV-5DucR_nad5gQHMAiGL7ROaN58W1WqnGXViiXIGhw0qpnQhcNfj-la2dDY5ICE4Jw6bg1lkALWey_bJoQTI9Gc4D88CRZuEG1x2IyAzhmwPrV9GXk9mEeuQ'

const userToken =
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IkNvZ25pdG9Mb2NhbCJ9.eyJjb2duaXRvOnVzZXJuYW1lIjoiYWRtaW4yIiwiYXV0aF90aW1lIjoxNzI1NTMyNzk3LCJlbWFpbCI6ImFkbWluQHRlc3QuY29tIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJldmVudF9pZCI6IjExNzY4NjljLTJiYjAtNDE3ZC1iMWI5LWI4YjJiMjBmNzRjNCIsImlhdCI6MTcyNTUzMjc5NywianRpIjoiMGYwY2NkMjItZTliNi00YTkzLWI0MDUtMDA5ODg4YWJlNTBkIiwic3ViIjoiOTJjYTRmNjgtOWFjNi00MDgwLTlhZTItMmYwMmE4NjIwNmE0IiwidG9rZW5fdXNlIjoiaWQiLCJjdXN0b206cm9sZXMiOiJbe1wicm9sZVwiOlwidXNlclwifV0iLCJleHAiOjE3MjU2MTkxOTcsImF1ZCI6ImRuazh5N2lpM3dsZWQzNXAzbHcwbDJjZDciLCJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjkyMjkvbG9jYWxfMkc3bm9IZ1cifQ.076V49LzDp8kSBYWXJgK0DH3tEFYzKwM79uhzb01pe86RJGLQXWjEnRxzVE9eF-nuGV87AMHEnB8NYtujClFN03QzEiBuiU2iGFmIL4VOy20FfunS4_yy6Wq0ZZuCmaDgZRBg0SRDm7KY7UCJn4ClU-j0ydCCbpSRoECgOpOsLZdIYaj4N3p5S7URQh_y2qsbvtRJ_kmSzLlAwXTv9sFOVJ2ddUAZlCyb6C1ow08rdqk3_YkV-h8gd6zRccgd2O-T4Y6ulvDaZuN-xc71qbACuUWdvp4sa3oyV-EIRvkIgYWrSF1-AuXDZyXt-6NpCDXQ1dusnTfK-8W4m4vy7JNHg'

const createRequestStub = (token: string, tenantCode = 'test') => ({
  headers: {
    'x-tenant-code': tenantCode,
  },
  get: () => token,
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
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['system_admin'])
    ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
      createRequestStub(systemAdminToken, ''),
    )
    // Act & Assert
    expect(await rolesGuard.canActivate(execution_context)).toBeFalsy()
    expect(reflector.getAllAndOverride).toHaveBeenCalledTimes(0)
  })

  /** Grants access when user's role matches required role */
  it('should return true if the user has the system admin role', async () => {
    // Arrange
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['system_admin'])
    ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
      createRequestStub(systemAdminToken),
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
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['system_admin', 'user'])
    ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
      createRequestStub(userToken),
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
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['system_admin'])
    ;(execution_context.switchToHttp().getRequest as jest.Mock).mockReturnValue(
      createRequestStub(userToken),
    )
    // Act & Assert
    expect(await rolesGuard.canActivate(execution_context)).toBeFalsy()
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLE_METADATA, [
      execution_context.getHandler(),
      execution_context.getClass(),
    ])
  })
})
