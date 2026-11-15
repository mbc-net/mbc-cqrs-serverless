import { BadRequestException } from '@nestjs/common'

import { buildTenantScope } from './rds'

const CAP = 10_000
const PERSONAL = [
  { sk: { startsWith: 'MASTER_SETTING#GROUP#' } },
  { sk: { startsWith: 'MASTER_SETTING#USER#' } },
]

describe('buildTenantScope includeCommon', () => {
  const prisma = { master: { findMany: jest.fn() } }
  const scope = (extra: Record<string, unknown>) =>
    buildTenantScope(prisma, {
      tenantCode: 'ta',
      commonTenantCode: 'common',
      masterType: 'MASTER_DATA',
      includeCommon: true,
      ...extra,
    })
  const rows = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ code: `S1#c${i}` }))

  beforeEach(() => {
    prisma.master.findMany.mockReset()
    prisma.master.findMany.mockResolvedValue([])
  })

  it('requires settingCode for a data merge', async () => {
    await expect(scope({})).rejects.toThrow(BadRequestException)
    expect(prisma.master.findMany).not.toHaveBeenCalled()
  })

  it('does not require settingCode when the tenant is the common tenant', async () => {
    await expect(scope({ tenantCode: 'common' })).resolves.toEqual({
      tenantCode: 'common',
    })
  })

  it('allows exactly the cap', async () => {
    prisma.master.findMany.mockResolvedValue(rows(CAP))
    const res: any = await scope({ masterTypeCode: 'S1' })
    expect(res.OR[1].code.notIn).toHaveLength(CAP)
    expect(prisma.master.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: CAP + 1 }),
    )
  })

  it('rejects one code over the cap', async () => {
    prisma.master.findMany.mockResolvedValue(rows(CAP + 1))
    await expect(scope({ masterTypeCode: 'S1' })).rejects.toThrow(
      BadRequestException,
    )
  })

  it('ignores personal rows on both sides of a settings merge', async () => {
    const res: any = await scope({ masterType: 'MASTER_SETTING' })
    expect(prisma.master.findMany.mock.calls[0][0].where.NOT).toEqual(PERSONAL)
    expect(res.OR[1].NOT).toEqual(PERSONAL)
  })

  it('keeps the scope unchanged without includeCommon', async () => {
    await expect(scope({ includeCommon: false })).resolves.toEqual({
      tenantCode: 'ta',
    })
    expect(prisma.master.findMany).not.toHaveBeenCalled()
  })
})
