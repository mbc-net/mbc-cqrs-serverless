import { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { GroupRoleResolverRegistry } from '../auth/group-role-resolver.registry'
import { RolesGuard } from '../guard/roles.guard'
import { IInvoke, JwtClaims } from './invoke'
import { CustomRole, getUserContext } from './user'

describe('explicit tenant selection opt-in', () => {
  const previous = process.env.EXPLICIT_TENANT_SELECTION_CODES
  beforeEach(() => {
    process.env.EXPLICIT_TENANT_SELECTION_CODES = 'common,shared'
  })
  afterEach(() => {
    if (previous === undefined)
      delete process.env.EXPLICIT_TENANT_SELECTION_CODES
    else process.env.EXPLICIT_TENANT_SELECTION_CODES = previous
  })

  function fixture(
    roles: CustomRole[],
    home: string | undefined = 'home',
    header = 'common',
  ) {
    const claims = {
      sub: 'user-1',
      'custom:tenant': home,
      'custom:roles': JSON.stringify(roles),
      'custom:groups': JSON.stringify([
        { tenant: 'home', groups: ['home-group'] },
        { tenant: 'common', groups: ['common-group'] },
      ]),
    } as JwtClaims
    const headers = { 'x-tenant-code': header }
    const invoke: IInvoke = {
      event: { headers, requestContext: { authorizer: { jwt: { claims } } } },
    }
    // Decode an actual token in extractInvokeContext; do not mock context or guard.
    const token = `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`
    const request = {
      headers,
      get: (key: string) =>
        key === 'authorization' ? `Bearer ${token}` : undefined,
    }
    const context = {
      getHandler: () => fixture,
      getClass: () => RolesGuard,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext
    const reflector = new Reflector()
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin'])
    const registry = new GroupRoleResolverRegistry()
    const resolveRoles = jest.fn().mockResolvedValue([])
    registry.set({ resolveRoles })
    const guard = new RolesGuard(reflector, registry)
    return { invoke, context, reflector, resolveRoles, guard }
  }

  it.each([
    ['admin', 'user', false],
    ['user', 'admin', true],
  ])(
    'home %s / common %s uses target permissions (%s)',
    async (homeRole, role, allowed) => {
      const f = fixture([
        { tenant: 'home', role: homeRole as string },
        { tenant: 'common', role: role as string },
      ])
      expect(getUserContext(f.invoke)).toMatchObject({
        tenantCode: 'common',
        tenantRole: role,
        tenantRoles: [role],
        tenantGroupIds: ['common-group'],
      })
      expect(getUserContext(f.context)).toEqual(getUserContext(f.invoke))
      expect(await f.guard.canActivate(f.context)).toBe(allowed)
    },
  )

  it.each(['', 'other'])(
    'carries %s-scoped system_admin only for explicit selection',
    async (scope) => {
      const f = fixture([
        { tenant: 'home', role: 'user' },
        { tenant: scope, role: 'system_admin' },
      ])
      expect(getUserContext(f.invoke)).toMatchObject({
        tenantCode: 'common',
        tenantRole: 'system_admin',
        tenantRoles: ['system_admin'],
      })
      expect(await f.guard.canActivate(f.context)).toBe(true)
    },
  )

  it('retains target roles and promotes scalar system_admin when both are present', async () => {
    const f = fixture([
      { tenant: 'common', role: 'user' },
      { tenant: 'other', role: 'system_admin' },
    ])
    expect(getUserContext(f.invoke)).toMatchObject({
      tenantRole: 'system_admin',
      tenantRoles: ['user', 'system_admin'],
    })
    expect(await f.guard.canActivate(f.context)).toBe(true)
  })

  it('does not carry unrelated global admin into explicit target selection', async () => {
    const f = fixture([
      { tenant: '', role: 'admin' },
      { tenant: 'common', role: 'user' },
    ])
    expect(getUserContext(f.invoke).tenantRoles).toEqual(['user'])
    expect(await f.guard.canActivate(f.context)).toBe(false)
  })

  it('uses target group IDs and resolved tenant for group authorization', async () => {
    const f = fixture([
      { tenant: 'home', role: 'admin' },
      { tenant: 'common', role: 'user' },
    ])
    f.resolveRoles.mockResolvedValue(['admin'])
    expect(await f.guard.canActivate(f.context)).toBe(true)
    expect(f.resolveRoles).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantCode: 'common',
        groupIds: ['common-group'],
      }),
    )
  })

  it('keeps nonmember home fallback for old clients', async () => {
    const f = fixture([{ tenant: 'home', role: 'admin' }])
    expect(getUserContext(f.invoke)).toMatchObject({
      tenantCode: 'home',
      tenantRoles: ['admin'],
      tenantGroupIds: ['home-group'],
    })
    expect(await f.guard.canActivate(f.context)).toBe(true)
  })

  it.each([
    { roles: [] },
    { roles: [{ tenant: '', role: 'admin' }] },
    { roles: [{ tenant: 'common', role: '' }] },
  ])(
    'denies no-home unauthorized opted header even without role metadata (%j)',
    async ({ roles }) => {
      const f = fixture(roles, '')
      f.reflector.getAllAndOverride = jest.fn().mockReturnValue(undefined)
      expect(getUserContext(f.invoke)).toMatchObject({
        tenantCode: undefined,
        tenantRoles: [],
        tenantGroupIds: [],
      })
      expect(await f.guard.canActivate(f.context)).toBe(false)
      expect(f.resolveRoles).not.toHaveBeenCalled()
    },
  )

  it('permits no-home explicit member of an opted code outside the public list', async () => {
    const f = fixture([{ tenant: 'shared', role: 'admin' }], '', 'shared')
    expect(getUserContext(f.invoke).tenantCode).toBe('shared')
    expect(await f.guard.canActivate(f.context)).toBe(true)
  })

  it.each([undefined, '', ' , , '])(
    'preserves original home priority with disabled setting %s',
    async (setting) => {
      if (setting === undefined)
        delete process.env.EXPLICIT_TENANT_SELECTION_CODES
      else process.env.EXPLICIT_TENANT_SELECTION_CODES = setting
      const f = fixture([
        { tenant: 'home', role: 'admin' },
        { tenant: 'common', role: 'user' },
      ])
      expect(getUserContext(f.invoke)).toMatchObject({
        tenantCode: 'home',
        tenantRoles: ['admin'],
      })
      expect(await f.guard.canActivate(f.context)).toBe(true)
    },
  )

  it.each(['other', '', 'common\r\ninvalid'])(
    'preserves original priority for non-opted header %j',
    (header) => {
      const f = fixture(
        [
          { tenant: 'home', role: 'user' },
          { tenant: 'other', role: 'system_admin' },
        ],
        'home',
        header,
      )
      expect(getUserContext(f.invoke)).toMatchObject({
        tenantCode: 'home',
        tenantRole: 'user',
        tenantRoles: ['user'],
      })
    },
  )

  it.each(['common', ' COMMON '])(
    'normalizes padded opted header and target role %j consistently',
    async (tenant) => {
      const f = fixture(
        [
          { tenant: 'home', role: 'admin' },
          { tenant, role: 'user' },
        ],
        'home',
        ' common ',
      )
      expect(getUserContext(f.invoke)).toMatchObject({
        tenantCode: 'common',
        tenantRole: 'user',
        tenantRoles: ['user'],
      })
      expect(await f.guard.canActivate(f.context)).toBe(false)
    },
  )

  it('normalizes target group tenant only for an explicit selection', () => {
    const f = fixture([{ tenant: 'common', role: 'user' }], 'common')
    f.invoke.event.requestContext.authorizer.jwt.claims['custom:groups'] =
      JSON.stringify([{ tenant: ' COMMON ', groups: ['target-group'] }])
    expect(getUserContext(f.invoke).tenantGroupIds).toEqual(['target-group'])
    delete process.env.EXPLICIT_TENANT_SELECTION_CODES
    expect(getUserContext(f.invoke).tenantGroupIds).toEqual([])
  })

  it('normalizes configuration, headers and role tenant casing', async () => {
    process.env.EXPLICIT_TENANT_SELECTION_CODES = ' COMMON, , Shared,common '
    const f = fixture([{ tenant: 'COMMON', role: 'admin' }], 'HOME', 'Common')
    expect(getUserContext(f.invoke).tenantCode).toBe('common')
    expect(await f.guard.canActivate(f.context)).toBe(true)
  })

  it('keeps legacy public common access when the feature is unset', async () => {
    delete process.env.EXPLICIT_TENANT_SELECTION_CODES
    const f = fixture([], '')
    f.reflector.getAllAndOverride = jest.fn().mockReturnValue(undefined)
    expect(getUserContext(f.invoke).tenantCode).toBe('common')
    expect(await f.guard.canActivate(f.context)).toBe(true)
  })
})
