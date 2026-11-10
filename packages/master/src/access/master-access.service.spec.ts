import { GroupRoleResolverRegistry, IInvoke } from '@mbc-cqrs-serverless/core'
import { ForbiddenException } from '@nestjs/common'

import { getSettingCodeFromSk, isPersonalSettingSk } from '../helpers'
import { MasterAccessGrant } from './master-access.interface'
import { MasterAccessResolverRegistry } from './master-access-resolver.registry'
import { MasterAccessService } from './master-access.service'

const ctx = (
  opts: {
    sub?: string
    tenant?: string
    role?: string
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
              'custom:tenant': tenant,
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
