import { createMock } from '@golevelup/ts-jest'
import {
  GroupRoleResolverRegistry,
  IGroupRoleResolver,
} from '@mbc-cqrs-serverless/core'
import { ExecutionContext } from '@nestjs/common'
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
}

const claims = (roles: { role: string }[], sub = 'user-1') => ({
  ...(sub ? { sub } : {}),
  'custom:tenant': 'test',
  'custom:roles': JSON.stringify(roles.map((r) => ({ tenant: 'test', ...r }))),
  'custom:groups': JSON.stringify([{ tenant: 'test', groups: ['team'] }]),
})

const buildContext = (
  method: string,
  handler: () => void = Routes.prototype.handler,
  tenant = 'test',
): ExecutionContext =>
  createMock<ExecutionContext>({
    getHandler: () => handler as any,
    getClass: () => Routes as any,
    switchToHttp: () => ({
      getRequest: () => ({
        method,
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
})
