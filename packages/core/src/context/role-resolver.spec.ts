import { JwtClaims } from './invoke'
import { parseCustomRolesJson, resolveTenantRoles } from './role-resolver'

describe('parseCustomRolesJson', () => {
  it('returns empty array when undefined', () => {
    expect(parseCustomRolesJson(undefined)).toEqual([])
  })

  it('parses valid JSON array', () => {
    const json = JSON.stringify([{ tenant: 'T1', role: 'admin' }])
    expect(parseCustomRolesJson(json)).toEqual([
      { tenant: 't1', role: 'admin' },
    ])
  })

  it('throws on invalid JSON', () => {
    expect(() => parseCustomRolesJson('not-json')).toThrow()
  })
})

describe('resolveTenantRoles', () => {
  const baseClaims = {
    sub: 'user-1',
  } as JwtClaims

  it('unions direct and group roles for tenant', () => {
    const claims: JwtClaims = {
      ...baseClaims,
      'custom:roles': JSON.stringify([{ tenant: '1801', role: 'user' }]),
      'custom:groups': JSON.stringify([
        { tenant: '1801', role: 'viewer' },
        { tenant: '1801', role: 'admin' },
      ]),
    }
    expect(resolveTenantRoles(claims, '1801').sort()).toEqual(
      ['admin', 'user', 'viewer'].sort(),
    )
  })

  it('includes global tenant empty string roles', () => {
    const claims: JwtClaims = {
      ...baseClaims,
      'custom:roles': JSON.stringify([]),
      'custom:groups': JSON.stringify([{ tenant: '', role: 'auditor' }]),
    }
    expect(resolveTenantRoles(claims, '1801')).toEqual(['auditor'])
  })

  it('dedupes duplicate role names', () => {
    const claims: JwtClaims = {
      ...baseClaims,
      'custom:roles': JSON.stringify([{ tenant: '1801', role: 'admin' }]),
      'custom:groups': JSON.stringify([{ tenant: '1801', role: 'admin' }]),
    }
    expect(resolveTenantRoles(claims, '1801')).toEqual(['admin'])
  })

  it('treats missing custom:groups as empty', () => {
    const claims: JwtClaims = {
      ...baseClaims,
      'custom:roles': JSON.stringify([{ tenant: '1801', role: 'user' }]),
    }
    expect(resolveTenantRoles(claims, '1801')).toEqual(['user'])
  })

  it('returns only global roles when tenantCode is undefined', () => {
    const claims: JwtClaims = {
      ...baseClaims,
      'custom:roles': JSON.stringify([{ tenant: '1801', role: 'user' }]),
      'custom:groups': JSON.stringify([{ tenant: '', role: 'auditor' }]),
    }
    expect(resolveTenantRoles(claims, undefined)).toEqual(['auditor'])
  })

  it('normalizes tenant code case when filtering', () => {
    const claims: JwtClaims = {
      ...baseClaims,
      'custom:groups': JSON.stringify([{ tenant: 'MY-TENANT', role: 'admin' }]),
    }
    expect(resolveTenantRoles(claims, 'my-tenant')).toEqual(['admin'])
  })
})
