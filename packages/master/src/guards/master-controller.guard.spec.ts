import { createMock } from '@golevelup/ts-jest'
import {
  GroupRoleResolverRegistry,
  IGroupRoleResolver,
} from '@mbc-cqrs-serverless/core'
import { BadRequestException, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import * as jwtDecode from 'jwt-decode'

import { MasterModuleOptions } from '../master.module-definition'
import { MasterControllerGuard } from './master-controller.guard'
import { MasterRoute } from './master-route.decorator'

jest.mock('jwt-decode', () => ({ jwtDecode: jest.fn() }))
const mockJwtDecode = jwtDecode.jwtDecode as jest.Mock

class Routes {
  handler() {}

  @MasterRoute({ read: true })
  checkExist() {}

  @MasterRoute({ targetsCommon: true })
  createCommon() {}
}

const claims = (
  roles: { role: string }[],
  sub = 'user-1',
  tenant = 'test',
) => ({
  ...(sub ? { sub } : {}),
  'custom:tenant': tenant,
  'custom:roles': JSON.stringify(roles.map((r) => ({ tenant, ...r }))),
  'custom:groups': JSON.stringify([{ tenant, groups: ['team'] }]),
})

const buildContext = (
  method: string,
  handler: () => void = Routes.prototype.handler,
  tenant = 'test',
  req: { params?: any; query?: any; body?: any } = {},
): ExecutionContext =>
  createMock<ExecutionContext>({
    getHandler: () => handler as any,
    getClass: () => Routes as any,
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        params: {},
        query: {},
        body: {},
        ...req,
        headers: { 'x-tenant-code': tenant },
        get: () => 'dummy.jwt.token',
      }),
    }),
  })

const buildGuard = (
  options?: MasterModuleOptions['controllerAuth'],
  groupRoles?: string[],
) => {
  let registry: GroupRoleResolverRegistry | undefined
  if (groupRoles) {
    registry = new GroupRoleResolverRegistry()
    const resolver: IGroupRoleResolver = {
      resolveRoles: jest.fn().mockResolvedValue(groupRoles),
    }
    registry.set(resolver)
  }
  return new MasterControllerGuard(
    new Reflector(),
    registry,
    options ? { controllerAuth: options } : ({} as MasterModuleOptions),
  )
}

describe('MasterControllerGuard', () => {
  afterEach(() => jest.clearAllMocks())

  it('allows everything when controllerAuth is not set', async () => {
    mockJwtDecode.mockReturnValue(claims([], ''))
    expect(await buildGuard().canActivate(buildContext('POST'))).toBe(true)
  })

  it('rejects no sub even with x-tenant-code: common', async () => {
    mockJwtDecode.mockReturnValue(claims([], ''))
    const ctx = buildContext('GET', undefined, 'common')
    expect(await buildGuard({}).canActivate(ctx)).toBe(false)
  })

  it('lets any logged-in user read with controllerAuth: {}', async () => {
    mockJwtDecode.mockReturnValue(claims([{ role: 'user' }]))
    expect(await buildGuard({}).canActivate(buildContext('GET'))).toBe(true)
  })

  it('requires system_admin to write with controllerAuth: {}', async () => {
    const guard = buildGuard({})
    mockJwtDecode.mockReturnValue(claims([{ role: 'user' }]))
    expect(await guard.canActivate(buildContext('POST'))).toBe(false)
    mockJwtDecode.mockReturnValue(claims([{ role: 'system_admin' }]))
    expect(await guard.canActivate(buildContext('POST'))).toBe(true)
  })

  it('accepts a configured write role', async () => {
    const guard = buildGuard({ write: ['editor'] })
    mockJwtDecode.mockReturnValue(claims([{ role: 'editor' }]))
    expect(await guard.canActivate(buildContext('PATCH'))).toBe(true)
    mockJwtDecode.mockReturnValue(claims([{ role: 'user' }]))
    expect(await guard.canActivate(buildContext('PATCH'))).toBe(false)
  })

  it('treats an empty write list as system_admin only', async () => {
    const guard = buildGuard({ write: [] })
    mockJwtDecode.mockReturnValue(claims([{ role: 'user' }]))
    expect(await guard.canActivate(buildContext('POST'))).toBe(false)
    mockJwtDecode.mockReturnValue(claims([{ role: 'system_admin' }]))
    expect(await guard.canActivate(buildContext('POST'))).toBe(true)
  })

  it('enforces a configured read role', async () => {
    mockJwtDecode.mockReturnValue(claims([{ role: 'user' }]))
    const guard = buildGuard({ read: ['viewer'] })
    expect(await guard.canActivate(buildContext('GET'))).toBe(false)
  })

  it('accepts a group-derived role', async () => {
    mockJwtDecode.mockReturnValue(claims([{ role: 'user' }]))
    const guard = buildGuard({ write: ['editor'] }, ['editor'])
    expect(await guard.canActivate(buildContext('DELETE'))).toBe(true)
  })

  it('treats @MasterRoute({ read: true }) POST as a read', async () => {
    mockJwtDecode.mockReturnValue(claims([{ role: 'user' }]))
    const ctx = buildContext('POST', Routes.prototype.checkExist)
    expect(await buildGuard({}).canActivate(ctx)).toBe(true)
  })

  describe('requested tenants', () => {
    const admin = [{ role: 'editor' }]
    const as = (tenant: string, roles = admin) =>
      mockJwtDecode.mockReturnValue(claims(roles, 'user-1', tenant))
    const ctx = (
      method: string,
      req: { params?: any; query?: any; body?: any },
      handler?: () => void,
    ) => buildContext(method, handler, 'ta', req)
    const user = [{ role: 'user' }]

    it('rejects a pk param from another tenant', async () => {
      as('ta')
      await expect(
        buildGuard({ write: ['editor'] }).canActivate(
          ctx('PUT', { params: { pk: 'MASTER#tb' } }),
        ),
      ).rejects.toThrow(new BadRequestException('Invalid tenant code'))
    })

    it('rejects an id param from another tenant', async () => {
      as('ta')
      await expect(
        buildGuard({ write: ['editor'] }).canActivate(
          ctx('PUT', { params: { id: 'MASTER#tb#code' } }),
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('allows an own-tenant id param with several segments', async () => {
      as('ta')
      const c = ctx('PUT', { params: { id: 'MASTER#ta#MASTER_SETTING#X' } })
      expect(await buildGuard({ write: ['editor'] }).canActivate(c)).toBe(true)
    })

    it('rejects a malformed pk or id param', async () => {
      as('ta')
      await expect(
        buildGuard({ write: ['editor'] }).canActivate(
          ctx('PUT', { params: { pk: 'MASTER' } }),
        ),
      ).rejects.toThrow(new BadRequestException('Invalid tenant code'))
      await expect(
        buildGuard({ write: ['editor'] }).canActivate(
          ctx('PUT', { params: { id: 'x' } }),
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('rejects a body tenantCode from another tenant', async () => {
      as('ta')
      await expect(
        buildGuard({ write: ['editor'] }).canActivate(
          ctx('POST', { body: { tenantCode: 'tb' } }),
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('rejects a query tenantCode from another tenant', async () => {
      as('ta')
      await expect(
        buildGuard({ write: ['editor'] }).canActivate(
          ctx('GET', { query: { tenantCode: 'tb' } }),
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('rejects an array tenantCode in the query', async () => {
      as('ta')
      await expect(
        buildGuard({ write: ['editor'] }).canActivate(
          ctx('GET', { query: { tenantCode: ['ta', 'tb'] } }),
        ),
      ).rejects.toThrow(new BadRequestException('Invalid tenant code'))
    })

    it('rejects a malformed targetTenants', async () => {
      as('ta')
      await expect(
        buildGuard({ write: ['editor'] }).canActivate(
          ctx('POST', { body: { targetTenants: 'tb' } }),
        ),
      ).rejects.toThrow(BadRequestException)
      await expect(
        buildGuard({ write: ['editor'] }).canActivate(
          ctx('POST', { body: { targetTenants: ['ta', 1] } }),
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('treats tenant codes case-insensitively', async () => {
      as('ta')
      const c = ctx('PUT', { params: { pk: 'MASTER#TA' } })
      expect(await buildGuard({ write: ['editor'] }).canActivate(c)).toBe(true)
    })

    it('allows reading the common tenant', async () => {
      as('ta', user)
      const c = ctx('GET', { query: { tenantCode: 'common' } })
      expect(await buildGuard({ write: ['editor'] }).canActivate(c)).toBe(true)
    })

    it('rejects writing common from another tenant', async () => {
      as('ta')
      await expect(
        buildGuard({ write: ['editor'] }).canActivate(
          ctx('PUT', { params: { pk: 'MASTER#common' } }),
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('allows writing another tenant with a cross-tenant role', async () => {
      as('ta', [{ role: 'system_admin' }])
      const guard = buildGuard({})
      const c = ctx('PUT', { params: { pk: 'MASTER#tb' } })
      expect(await guard.canActivate(c)).toBe(true)
    })

    it('uses the configured common tenant', async () => {
      as('ta', user)
      const guard = new MasterControllerGuard(new Reflector(), undefined, {
        controllerAuth: {},
        commonTenantCode: 'shared',
      } as MasterModuleOptions)
      const c = ctx('GET', { query: { tenantCode: 'shared' } })
      expect(await guard.canActivate(c)).toBe(true)
    })

    it('applies targetsCommon to POST /common', async () => {
      as('ta')
      await expect(
        buildGuard({ write: ['editor'] }).canActivate(
          ctx('POST', {}, Routes.prototype.createCommon),
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('checks masterSettingId as a read and targetTenants as writes', async () => {
      as('ta')
      const guard = buildGuard({ write: ['editor'] })
      const copy = (masterSettingId: string) =>
        guard.canActivate(ctx('POST', { body: { masterSettingId } }))
      expect(await copy('MASTER#ta#MASTER_SETTING#X')).toBe(true)
      expect(await copy('MASTER#common#MASTER_SETTING#X')).toBe(true)
      await expect(copy('MASTER#tb#MASTER_SETTING#X')).rejects.toThrow(
        BadRequestException,
      )
      await expect(
        guard.canActivate(ctx('POST', { body: { targetTenants: ['tb'] } })),
      ).rejects.toThrow(BadRequestException)
      await expect(
        guard.canActivate(ctx('POST', { body: { targetTenants: ['common'] } })),
      ).rejects.toThrow(BadRequestException)
    })

    it('skips these checks when controllerAuth is not set', async () => {
      as('ta')
      const c = ctx('PUT', { params: { pk: 'MASTER#tb' } })
      expect(await buildGuard().canActivate(c)).toBe(true)
    })
  })
})
