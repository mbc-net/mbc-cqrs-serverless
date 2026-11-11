import { GroupRoleResolverRegistry, IInvoke } from '@mbc-cqrs-serverless/core'
import { BadRequestException, ForbiddenException } from '@nestjs/common'

import { getSettingCodeFromSk, isPersonalSettingSk } from '../helpers'
import { MasterAccessGrant } from './master-access.interface'
import { MasterAccessResolverRegistry } from './master-access-resolver.registry'
import { MasterAccessService } from './master-access.service'

const ctx = (
  opts: {
    sub?: string
    tenant?: string
    role?: string
    noClaim?: boolean
    groups?: string[]
  } = {},
): IInvoke => {
  const { sub = 'u1', tenant = 'ta', role = 'user', groups = [] } = opts
  return {
    event: {
      headers: { 'x-tenant-code': tenant },
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              ...(sub ? { sub } : {}),
              ...(opts.noClaim ? {} : { 'custom:tenant': tenant }),
              'custom:roles': JSON.stringify([{ tenant, role }]),
              'custom:groups': JSON.stringify([{ tenant, groups }]),
            },
          },
        },
      },
    },
  } as unknown as IInvoke
}

const grant = (
  systemId: string,
  settingCode: string,
  read: boolean,
  write = false,
): MasterAccessGrant => ({ systemId, settingCode, read, write })

const build = (
  grants?: MasterAccessGrant[] | Error,
  groupRoles?: string[],
  commonTenantCode?: string,
) => {
  const registry = new MasterAccessResolverRegistry()
  const resolveGrants = jest.fn().mockImplementation(async () => {
    if (grants instanceof Error) throw grants
    return grants
  })
  if (grants) registry.set({ resolveGrants })
  let groups: GroupRoleResolverRegistry | undefined
  if (groupRoles) {
    groups = new GroupRoleResolverRegistry()
    groups.set({ resolveRoles: jest.fn().mockResolvedValue(groupRoles) })
  }
  const commandService = { getLatestItem: jest.fn() }
  const service = new MasterAccessService(
    registry,
    commandService as any,
    groups,
    commonTenantCode ? ({ commonTenantCode } as any) : undefined,
  )
  return { service, resolveGrants, commandService }
}

const target = (tenantCode = 'ta', systemId?: string, settingCode = 'S1') => ({
  tenantCode,
  systemId,
  settingCode,
})

describe('MasterAccessService', () => {
  describe('getAccess', () => {
    it('is disabled with no resolver', async () => {
      const { service } = build()
      expect(service.isEnabled()).toBe(false)
      expect(await service.getAccess({ invokeContext: ctx() })).toEqual({
        enabled: false,
        grants: [],
      })
    })

    it('returns no grants for a logged-out caller without calling the resolver', async () => {
      const { service, resolveGrants } = build([grant('*', '*', true)])
      expect(service.isEnabled()).toBe(true)
      expect(
        await service.getAccess({ invokeContext: ctx({ sub: '' }) }),
      ).toEqual({ enabled: true, grants: [] })
      expect(resolveGrants).not.toHaveBeenCalled()
    })

    it('returns the caller grants', async () => {
      const g = [grant('s1', 'S1', true)]
      const { service } = build(g)
      expect(await service.getAccess({ invokeContext: ctx() })).toEqual({
        enabled: true,
        grants: g,
      })
    })
  })

  describe('assertAccess', () => {
    const read = (s: MasterAccessService, t: any, o: any = {}) =>
      s.assertAccess(t, 'read', { invokeContext: ctx(), ...o })
    const write = (s: MasterAccessService, t: any, o: any = {}) =>
      s.assertAccess(t, 'write', { invokeContext: ctx(), ...o })

    it('passes with skipAccessCheck', async () => {
      const { service } = build([])
      await expect(
        service.assertAccess(target('tb'), 'write', { skipAccessCheck: true }),
      ).resolves.toBeUndefined()
    })

    it('does nothing when no resolver is registered', async () => {
      const { service } = build()
      await expect(
        service.assertAccess(target('tb'), 'write', {}),
      ).resolves.toBeUndefined()
    })

    it('throws Forbidden with no invokeContext', async () => {
      const { service } = build([grant('*', '*', true, true)])
      await expect(
        service.assertAccess(target(), 'read', {}),
      ).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('throws Forbidden on another tenant', async () => {
      const { service } = build([grant('*', '*', true, true)])
      await expect(read(service, target('tb'))).rejects.toBeInstanceOf(
        ForbiddenException,
      )
    })

    it('compares tenants case-insensitively', async () => {
      const { service } = build([grant('shared', 'S1', true)])
      await expect(read(service, target('TA'))).resolves.toBeUndefined()
    })

    it('allows reading the common tenant, subject to grants', async () => {
      const { service } = build([grant('shared', 'S1', true)])
      await expect(read(service, target('common'))).resolves.toBeUndefined()
    })

    it('honours a configured commonTenantCode', async () => {
      const { service } = build([grant('shared', 'S1', true)], undefined, 'Hub')
      await expect(read(service, target('hub'))).resolves.toBeUndefined()
    })

    it('denies reading a common row for a system with no grant', async () => {
      const { service } = build([grant('shared', 'S1', true)])
      await expect(
        read(service, target('common', 'other')),
      ).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('denies writing the common tenant from another tenant', async () => {
      const { service } = build([grant('*', '*', true, true)])
      await expect(write(service, target('common'))).rejects.toBeInstanceOf(
        ForbiddenException,
      )
    })

    it('allows a cross-tenant role through the tenant gate', async () => {
      const { service } = build([grant('*', '*', true, true)])
      await expect(
        write(service, target('tb'), {
          invokeContext: ctx({ role: 'system_admin' }),
        }),
      ).resolves.toBeUndefined()
    })

    it('denies an anonymous write even with a write grant', async () => {
      const { service } = build([grant('*', '*', true, true)])
      await expect(
        write(service, target(), {
          invokeContext: ctx({ sub: '' }),
          scope: { tenantCode: 'ta' },
        }),
      ).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('denies an anonymous read of a common target with no scope.tenantCode', async () => {
      const { service, resolveGrants } = build([grant('*', '*', true)])
      await expect(
        read(service, target('common'), { invokeContext: ctx({ sub: '' }) }),
      ).rejects.toBeInstanceOf(ForbiddenException)
      expect(resolveGrants).not.toHaveBeenCalled()
    })

    it('denies a header-named tenant with no custom:tenant claim', async () => {
      const { service } = build([grant('*', '*', true, true)])
      await expect(
        read(service, target('ta'), { invokeContext: ctx({ noClaim: true }) }),
      ).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('lets a common header tenant with no claim reach the grants check', async () => {
      const ok = build([grant('shared', 'S1', true)])
      const invokeContext = ctx({ noClaim: true, tenant: 'common' })
      await expect(
        read(ok.service, target('common'), { invokeContext }),
      ).resolves.toBeUndefined()
      const none = build([])
      await expect(
        read(none.service, target('common'), { invokeContext }),
      ).rejects.toBeInstanceOf(ForbiddenException)
      expect(none.resolveGrants).toHaveBeenCalledTimes(1)
    })

    it('lets a cross-tenant role with no claim pass the gate', async () => {
      const { service } = build([grant('*', '*', true, true)])
      await expect(
        write(service, target('ta'), {
          invokeContext: ctx({ noClaim: true, role: 'system_admin' }),
        }),
      ).resolves.toBeUndefined()
    })

    it('is unaffected by the header rule when the claim is present', async () => {
      const { service } = build([grant('*', '*', true)])
      await expect(read(service, target('ta'))).resolves.toBeUndefined()
    })

    it('denies an anonymous caller with no scope.tenantCode', async () => {
      const { service } = build([grant('*', '*', true, true)])
      await expect(
        read(service, target(), { invokeContext: ctx({ sub: '' }) }),
      ).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('allows an anonymous read inside scope.tenantCode with a read grant', async () => {
      const { service } = build([grant('*', '*', true)])
      await expect(
        read(service, target(), {
          invokeContext: ctx({ sub: '' }),
          scope: { tenantCode: 'ta' },
        }),
      ).resolves.toBeUndefined()
    })

    it('denies a record outside scope.tenantCode or scope.systemId', async () => {
      const { service } = build([grant('*', '*', true, true)])
      await expect(
        read(service, target('common'), {
          invokeContext: ctx({ role: 'system_admin' }),
          scope: { tenantCode: 'ta' },
        }),
      ).resolves.toBeUndefined()
      await expect(
        write(service, target('common'), {
          invokeContext: ctx({ role: 'system_admin' }),
          scope: { tenantCode: 'ta' },
        }),
      ).rejects.toBeInstanceOf(ForbiddenException)
      await expect(
        read(service, target('ta', 's2'), { scope: { systemId: 's1' } }),
      ).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('treats a missing systemId as shared', async () => {
      const { service } = build([grant('shared', 'S1', true)])
      await expect(read(service, target())).resolves.toBeUndefined()
      await expect(
        read(service, target(), { scope: { systemId: 'shared' } }),
      ).resolves.toBeUndefined()
      await expect(
        read(service, target(), { scope: { systemId: 's1' } }),
      ).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('lets write imply read', async () => {
      const { service } = build([grant('s1', 'S1', false, true)])
      await expect(read(service, target('ta', 's1'))).resolves.toBeUndefined()
    })

    it('denies a write with a read-only grant', async () => {
      const { service } = build([grant('s1', 'S1', true)])
      await expect(write(service, target('ta', 's1'))).rejects.toBeInstanceOf(
        ForbiddenException,
      )
    })

    it('matches * for system and for setting code', async () => {
      const { service } = build([grant('*', '*', true)])
      await expect(
        read(service, target('ta', 's9', 'ANY')),
      ).resolves.toBeUndefined()
      const other = build([grant('s1', '*', true), grant('*', 'S2', true)])
      await expect(
        read(other.service, target('ta', 's1', 'X')),
      ).resolves.toBeUndefined()
      await expect(
        read(other.service, target('ta', 's7', 'S2')),
      ).resolves.toBeUndefined()
      await expect(
        read(other.service, target('ta', 's7', 'X')),
      ).rejects.toBeInstanceOf(ForbiddenException)
    })

    it('propagates a resolver error and grants nothing', async () => {
      const { service } = build(new Error('boom'))
      await expect(read(service, target())).rejects.toThrow('boom')
    })

    it('calls the resolver once per invokeContext', async () => {
      const { service, resolveGrants } = build([grant('*', '*', true)])
      const invokeContext = ctx()
      await read(service, target(), { invokeContext })
      await read(service, target(), { invokeContext })
      expect(resolveGrants).toHaveBeenCalledTimes(1)
    })

    it('resolves again when the event of a reused invoke object changes', async () => {
      const { service, resolveGrants } = build()
      resolveGrants.mockReset()
      ;(service as any).registry.set({ resolveGrants })
      resolveGrants
        .mockResolvedValueOnce([grant('s1', 'S1', true)])
        .mockResolvedValueOnce([grant('s2', 'S1', true)])
      const invokeContext = ctx({ sub: 'u1' })
      expect(
        (await service.getAccess({ invokeContext })).grants[0].systemId,
      ).toBe('s1')
      invokeContext.event = ctx({ sub: 'u2' }).event
      expect(
        (await service.getAccess({ invokeContext })).grants[0].systemId,
      ).toBe('s2')
      expect(resolveGrants).toHaveBeenCalledTimes(2)
    })

    it('passes direct and group-derived roles to the resolver', async () => {
      const { service, resolveGrants } = build(
        [grant('*', '*', true)],
        ['editor'],
      )
      await read(service, target(), {
        invokeContext: ctx({ groups: ['g1'], role: 'user' }),
      })
      expect(resolveGrants).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          tenantCode: 'ta',
          roles: ['user', 'editor'],
        }),
      )
    })
  })

  describe('assertTenant', () => {
    it('applies the tenant gate without grants', async () => {
      const { service, resolveGrants } = build([])
      const invokeContext = ctx()
      await expect(
        service.assertTenant('TA', 'write', { invokeContext }),
      ).resolves.toBeUndefined()
      await expect(
        service.assertTenant('tb', 'write', { invokeContext }),
      ).rejects.toBeInstanceOf(ForbiddenException)
      await expect(
        service.assertTenant('common', 'read', { invokeContext }),
      ).resolves.toBeUndefined()
      expect(resolveGrants).not.toHaveBeenCalled()
    })
  })

  describe('assertCrossTenant', () => {
    it('passes with no resolver or skipAccessCheck', () => {
      expect(() => build().service.assertCrossTenant({})).not.toThrow()
      expect(() =>
        build([]).service.assertCrossTenant({ skipAccessCheck: true }),
      ).not.toThrow()
    })

    it('requires a cross-tenant role otherwise', () => {
      const { service } = build([])
      expect(() => service.assertCrossTenant({ invokeContext: ctx() })).toThrow(
        ForbiddenException,
      )
      expect(() => service.assertCrossTenant({})).toThrow(ForbiddenException)
      expect(() =>
        service.assertCrossTenant({
          invokeContext: ctx({ role: 'system_admin' }),
        }),
      ).not.toThrow()
    })
  })

  describe('getEffectiveSetting', () => {
    it('prefers the tenant setting, then the common tenant', async () => {
      const { service, commandService } = build([])
      const own = { pk: 'MASTER#ta', sk: 'MASTER_SETTING#S1' }
      const common = { pk: 'MASTER#common', sk: 'MASTER_SETTING#S1' }
      commandService.getLatestItem.mockResolvedValueOnce(own)
      expect(await service.getEffectiveSetting('ta', 'S1')).toBe(own)
      expect(commandService.getLatestItem).toHaveBeenCalledWith({
        pk: 'MASTER#ta',
        sk: 'MASTER_SETTING#S1',
      })
      commandService.getLatestItem
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(common)
      expect(await service.getEffectiveSetting('ta', 'S1')).toBe(common)
      commandService.getLatestItem.mockResolvedValue(null)
      expect(await service.getEffectiveSetting('ta', 'S1')).toBeNull()
    })

    it('uses the configured common tenant code as written', async () => {
      const { service, commandService } = build([], undefined, 'Hub')
      commandService.getLatestItem.mockResolvedValue(null)
      await service.getEffectiveSetting('ta', 'S1')
      expect(commandService.getLatestItem).toHaveBeenLastCalledWith({
        pk: 'MASTER#Hub',
        sk: 'MASTER_SETTING#S1',
      })
    })

    it('does not look up the common tenant twice', async () => {
      const { service, commandService } = build([])
      commandService.getLatestItem.mockResolvedValue(null)
      expect(await service.getEffectiveSetting('common', 'S1')).toBeNull()
      expect(commandService.getLatestItem).toHaveBeenCalledTimes(1)
    })
  })
})

describe('setting key helpers', () => {
  it('returns the code for setting, personal setting and data keys', () => {
    expect(getSettingCodeFromSk('MASTER_SETTING#X')).toBe('X')
    expect(getSettingCodeFromSk('MASTER_SETTING#USER#u1#X')).toBe('X')
    expect(getSettingCodeFromSk('X#A1@3')).toBe('X')
  })

  it('detects personal setting keys', () => {
    expect(isPersonalSettingSk('MASTER_SETTING#X')).toBe(false)
    expect(isPersonalSettingSk('MASTER_SETTING#USER#u1#X')).toBe(true)
    expect(isPersonalSettingSk('X#A1')).toBe(false)
  })
})

describe('prepareSettingOwner', () => {
  const all = [grant('*', '*', true, true)]
  const opts = () => ({ invokeContext: ctx() })
  const input = (extra: object = {}) => ({
    tenantCode: 'ta',
    code: 'S1',
    ...extra,
  })

  it('stores nothing and does no lookup without a resolver', async () => {
    const { service, commandService } = build()
    expect(
      await service.prepareSettingOwner(input({ requested: 'X' }), opts()),
    ).toBeUndefined()
    expect(commandService.getLatestItem).not.toHaveBeenCalled()
  })

  it('returns the requested systemId for a new setting', async () => {
    const { service, commandService } = build(all)
    commandService.getLatestItem.mockResolvedValue(null)
    expect(
      await service.prepareSettingOwner(input({ requested: 'a' }), opts()),
    ).toBe('a')
  })

  it('stores a requested systemId in lower case', async () => {
    const { service, commandService } = build(all)
    commandService.getLatestItem.mockResolvedValue(null)
    expect(
      await service.prepareSettingOwner(input({ requested: 'APP-A' }), opts()),
    ).toBe('app-a')
  })

  it('rejects * as a requested systemId', async () => {
    const { service, commandService } = build(all)
    commandService.getLatestItem.mockResolvedValue(null)
    await expect(
      service.prepareSettingOwner(input({ requested: '*' }), opts()),
    ).rejects.toThrow(BadRequestException)
  })

  it('leaves systemId unset when none is requested', async () => {
    const { service, commandService } = build(all)
    commandService.getLatestItem.mockResolvedValue(null)
    expect(await service.prepareSettingOwner(input(), opts())).toBeUndefined()
  })

  it('inherits from the common tenant setting', async () => {
    const { service, commandService } = build(all)
    commandService.getLatestItem.mockResolvedValue({
      attributes: { __systemId: 'A' },
    })
    expect(await service.prepareSettingOwner(input(), opts())).toBe('A')
  })

  it('rejects a value conflicting with the inherited owner', async () => {
    const { service, commandService } = build(all)
    commandService.getLatestItem.mockResolvedValue({
      attributes: { __systemId: 'A' },
    })
    await expect(
      service.prepareSettingOwner(input({ requested: 'B' }), opts()),
    ).rejects.toThrow(BadRequestException)
  })

  it('keeps the owner of an existing row without a lookup', async () => {
    const { service, commandService } = build(all)
    const existing = { isDeleted: true, attributes: { __systemId: 'A' } } as any
    expect(
      await service.prepareSettingOwner(input({ existing, requested: 'A' }), {
        ...opts(),
        systemId: 'Z',
      }),
    ).toBe('A')
    expect(commandService.getLatestItem).not.toHaveBeenCalled()
  })

  it('rejects a different systemId on an existing row', async () => {
    const { service } = build(all)
    const existing = { attributes: { __systemId: 'A' } } as any
    await expect(
      service.prepareSettingOwner(input({ existing, requested: 'B' }), opts()),
    ).rejects.toThrow(BadRequestException)
  })

  it('rejects a requested systemId on an untagged existing row', async () => {
    const { service } = build(all)
    const existing = { attributes: {} } as any
    await expect(
      service.prepareSettingOwner(input({ existing, requested: 'B' }), opts()),
    ).rejects.toThrow(BadRequestException)
  })

  it('checks write access against the final owner', async () => {
    const { service, commandService } = build([grant('b', '*', true, true)])
    commandService.getLatestItem.mockResolvedValue(null)
    await expect(
      service.prepareSettingOwner(input({ requested: 'a' }), opts()),
    ).rejects.toThrow(ForbiddenException)
    await expect(
      service.prepareSettingOwner(input({ requested: 'b' }), opts()),
    ).resolves.toBe('b')
  })

  it('treats a blank requested systemId as absent on a new row', async () => {
    const { service, commandService } = build(all)
    commandService.getLatestItem.mockResolvedValue(null)
    expect(
      await service.prepareSettingOwner(input({ requested: '' }), opts()),
    ).toBeUndefined()
  })

  it('does not treat a null requested systemId as a conflict', async () => {
    const { service } = build(all)
    const existing = { attributes: { __systemId: 'A' } } as any
    expect(
      await service.prepareSettingOwner(
        input({ existing, requested: null }),
        opts(),
      ),
    ).toBe('A')
  })

  it('uses options.systemId from internal callers', async () => {
    const { service, commandService } = build(all)
    commandService.getLatestItem.mockResolvedValue(null)
    expect(
      await service.prepareSettingOwner(input(), { ...opts(), systemId: 'Z' }),
    ).toBe('Z')
  })
})

describe('prepareDataOwner', () => {
  const all = [grant('*', '*', true, true)]
  const opts = () => ({ invokeContext: ctx() })
  const input = (extra: object = {}) => ({
    tenantCode: 'ta',
    settingCode: 'S1',
    ...extra,
  })

  it('does no lookup without a resolver', async () => {
    const { service, commandService } = build()
    expect(
      await service.prepareDataOwner(input(), { ...opts(), systemId: 'X' }),
    ).toBeUndefined()
    expect(commandService.getLatestItem).not.toHaveBeenCalled()
  })

  it('takes the owner from the tenant setting', async () => {
    const { service, commandService } = build(all)
    commandService.getLatestItem.mockResolvedValueOnce({
      attributes: { __systemId: 'A' },
    })
    expect(await service.prepareDataOwner(input(), opts())).toBe('A')
    expect(commandService.getLatestItem).toHaveBeenCalledTimes(1)
  })

  it('takes the owner from the common setting', async () => {
    const { service, commandService } = build(all)
    commandService.getLatestItem
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ attributes: { __systemId: 'C' } })
    expect(await service.prepareDataOwner(input(), opts())).toBe('C')
  })

  it('rejects a row whose setting does not exist', async () => {
    const { service, commandService } = build(all)
    commandService.getLatestItem.mockResolvedValue(null)
    await expect(service.prepareDataOwner(input(), opts())).rejects.toThrow(
      BadRequestException,
    )
  })

  it('leaves the owner undefined for a missing setting when skipAccessCheck is set', async () => {
    const { service, commandService } = build(all)
    commandService.getLatestItem.mockResolvedValue(null)
    expect(
      await service.prepareDataOwner(input(), {
        ...opts(),
        skipAccessCheck: true,
      }),
    ).toBeUndefined()
  })

  it('keeps the stored owner of an existing row without a lookup', async () => {
    const { service, commandService } = build(all)
    const existing = { attributes: { __systemId: 'A' } } as any
    expect(
      await service.prepareDataOwner(input({ existing }), {
        ...opts(),
        systemId: 'Z',
      }),
    ).toBe('A')
    expect(commandService.getLatestItem).not.toHaveBeenCalled()
  })

  it('adopts the setting owner for an untagged existing row', async () => {
    const { service, commandService } = build(all)
    commandService.getLatestItem.mockResolvedValue({
      attributes: { __systemId: 'A' },
    })
    const existing = { attributes: {} } as any
    expect(await service.prepareDataOwner(input({ existing }), opts())).toBe(
      'A',
    )
  })

  it('leaves an untagged existing row untagged when its setting is gone', async () => {
    const { service, commandService } = build([
      grant('shared', '*', true, true),
    ])
    commandService.getLatestItem.mockResolvedValue(null)
    const existing = { attributes: {} } as any
    expect(
      await service.prepareDataOwner(input({ existing }), opts()),
    ).toBeUndefined()
  })

  it('uses options.systemId without a lookup', async () => {
    const { service, commandService } = build(all)
    expect(
      await service.prepareDataOwner(input(), { ...opts(), systemId: 'Z' }),
    ).toBe('Z')
    expect(commandService.getLatestItem).not.toHaveBeenCalled()
  })

  it('denies a user without write on the owner', async () => {
    const { service } = build([grant('B', '*', true, true)])
    const existing = { attributes: { __systemId: 'A' } } as any
    await expect(
      service.prepareDataOwner(input({ existing }), opts()),
    ).rejects.toThrow(ForbiddenException)
  })

  it('skips the check for internal callers', async () => {
    const { service } = build([grant('B', '*', true, true)])
    const existing = { attributes: { __systemId: 'A' } } as any
    expect(
      await service.prepareDataOwner(input({ existing }), {
        ...opts(),
        skipAccessCheck: true,
      }),
    ).toBe('A')
  })
})

describe('buildListFilter', () => {
  const opts = (extra: object = {}) => ({ invokeContext: ctx(), ...extra })

  it('returns undefined with no resolver', async () => {
    const { service } = build()
    expect(await service.buildListFilter('data', opts())).toBeUndefined()
  })

  it('returns undefined for internal callers', async () => {
    const { service } = build([grant('app-a', '*', true)])
    expect(
      await service.buildListFilter('data', opts({ skipAccessCheck: true })),
    ).toBeUndefined()
  })

  it('returns undefined for a * and * grant', async () => {
    const { service } = build([grant('*', '*', true)])
    expect(await service.buildListFilter('data', opts())).toBeUndefined()
  })

  it('builds one condition per grant', async () => {
    const { service } = build([
      grant('app-a', '*', true),
      grant('shared', 'PREFECTURE', true),
    ])
    expect(await service.buildListFilter('data', opts())).toEqual({
      OR: [
        { systemId: 'app-a' },
        {
          OR: [{ systemId: 'shared' }, { systemId: null }],
          masterTypeCode: 'PREFECTURE',
        },
      ],
    })
  })

  it('returns a single condition as it is', async () => {
    const { service } = build([grant('app-a', 'S1', true)])
    expect(await service.buildListFilter('data', opts())).toEqual({
      systemId: 'app-a',
      masterTypeCode: 'S1',
    })
  })

  const personalRows = [
    { sk: { startsWith: 'MASTER_SETTING#GROUP#' } },
    { sk: { startsWith: 'MASTER_SETTING#USER#' } },
  ]

  it('uses masterCode for settings', async () => {
    const { service } = build([grant('app-a', 'S1', true)])
    expect(await service.buildListFilter('setting', opts())).toEqual({
      systemId: 'app-a',
      masterCode: 'S1',
      NOT: personalRows,
    })
  })

  it('hides group and user setting rows from a restricted setting list', async () => {
    const { service } = build([grant('shared', '*', true)])
    expect(await service.buildListFilter('setting', opts())).toEqual({
      OR: [{ systemId: 'shared' }, { systemId: null }],
      NOT: personalRows,
    })
    expect(await service.buildListFilter('data', opts())).toEqual({
      OR: [{ systemId: 'shared' }, { systemId: null }],
    })
  })

  it('shows group and user setting rows to an unrestricted caller', async () => {
    const { service } = build([grant('*', '*', true)])
    expect(await service.buildListFilter('setting', opts())).toBeUndefined()
  })

  it('lowercases a grant systemId', async () => {
    const { service } = build([grant('APP-A', '*', true)])
    expect(await service.buildListFilter('data', opts())).toEqual({
      systemId: 'app-a',
    })
  })

  it('lowercases the search systemId it narrows to', async () => {
    const { service } = build([grant('*', '*', true)])
    expect(await service.buildListFilter('data', opts(), 'APP-A')).toEqual({
      systemId: 'app-a',
    })
  })

  it('counts only grants with read or write', async () => {
    const { service } = build([
      grant('a', '*', false),
      grant('b', '*', false, true),
    ])
    expect(await service.buildListFilter('data', opts())).toEqual({
      systemId: 'b',
    })
  })

  it('returns an empty match with no grants', async () => {
    const { service } = build([])
    expect(await service.buildListFilter('data', opts())).toEqual({
      id: { in: [] },
    })
  })

  it('narrows a * grant to the search systemId', async () => {
    const { service } = build([grant('*', '*', true)])
    expect(await service.buildListFilter('data', opts(), 'app-a')).toEqual({
      systemId: 'app-a',
    })
  })

  it('treats a blank search systemId as absent', async () => {
    const { service } = build([grant('*', '*', true)])
    expect(await service.buildListFilter('data', opts(), '  ')).toBeUndefined()
  })

  it('ignores a search systemId the user has no grant for', async () => {
    const { service } = build([grant('app-a', '*', true)])
    expect(await service.buildListFilter('data', opts(), 'other')).toEqual({
      id: { in: [] },
    })
  })

  it('intersects scope.systemId with the search value', async () => {
    const { service } = build([grant('*', '*', true)])
    const scoped = opts({ scope: { systemId: 'app-a' } })
    expect(await service.buildListFilter('data', scoped, 'app-a')).toEqual({
      systemId: 'app-a',
    })
    expect(await service.buildListFilter('data', scoped, 'other')).toEqual({
      id: { in: [] },
    })
    expect(await service.buildListFilter('data', scoped)).toEqual({
      systemId: 'app-a',
    })
  })
})
