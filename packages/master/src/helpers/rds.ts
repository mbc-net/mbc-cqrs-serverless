import { BadRequestException } from '@nestjs/common'

import { DATA_SK_PREFIX, SETTING_SK_PREFIX } from '../constants'
import { PERSONAL_SETTING_ROWS } from './index'

/**
 * Most own rows the includeCommon merge hides by code. Each one is a bind parameter, and
 * PostgreSQL allows 32,767 per query, leaving room for the rest of the filter.
 */
// ponytail: cap on the in-memory notIn list; ceiling is one setting with more rows than this.
// Upgrade path: a raw `NOT EXISTS` query for the common branch.
export const MAX_INCLUDE_COMMON_CODES = 10_000

export function getOrderBy(order: string) {
  let orderValue = 'asc',
    orderKey = order
  if (order.startsWith('-')) {
    orderValue = 'desc'
    orderKey = order.slice(1)
  }

  return { [orderKey]: orderValue }
}

export function getOrderBys<T>(orders: string[]): T[] {
  if (!orders) {
    return undefined
  }
  return orders.map((order) => getOrderBy(order)) as T[]
}

/**
 * Build the tenant part of a list `where`. With `includeCommon`, rows of the common tenant are
 * merged in, except codes the tenant already has (soft-deleted ones included, so a tenant can
 * override or hide a common row). With `hideDeletedSettings`, a data row whose setting is
 * soft-deleted in the row's own tenant is left out.
 */
export async function buildTenantScope(
  prisma: any,
  input: {
    tenantCode: string
    commonTenantCode: string
    masterType: string
    masterTypeCode?: string
    includeCommon?: boolean
    hideDeletedSettings?: boolean
  },
): Promise<Record<string, unknown>> {
  const { tenantCode, commonTenantCode, masterType, masterTypeCode } = input
  const withCommon =
    !!input.includeCommon &&
    tenantCode?.toLowerCase() !== commonTenantCode?.toLowerCase()
  const settings = masterType === SETTING_SK_PREFIX
  if (withCommon && masterType === DATA_SK_PREFIX && !masterTypeCode) {
    throw new BadRequestException(
      'includeCommon requires settingCode for master data lists',
    )
  }

  const deleted: { masterCode: string; tenantCode?: string }[] =
    input.hideDeletedSettings
      ? await prisma.master.findMany({
          where: {
            tenantCode: withCommon
              ? { in: [tenantCode, commonTenantCode] }
              : tenantCode,
            isDeleted: true,
            masterType: SETTING_SK_PREFIX,
          },
          select: { masterCode: true, tenantCode: true },
        })
      : []
  // Without a tenant, every code found (the query already holds one tenant).
  const hideDeletedIn = (tenant?: string) => {
    const codes = deleted
      .filter(
        (s) => !tenant || s.tenantCode?.toLowerCase() === tenant.toLowerCase(),
      )
      .map((s) => s.masterCode)
    return codes.length ? { masterTypeCode: { notIn: codes } } : {}
  }

  if (!withCommon) {
    return { tenantCode, ...hideDeletedIn() }
  }

  // Personal rows are never merged, so they need no hiding (and must not fill the cap).
  const own = await prisma.master.findMany({
    where: {
      tenantCode,
      masterType,
      ...(masterTypeCode && { masterTypeCode }),
      ...(settings && { NOT: PERSONAL_SETTING_ROWS }),
    },
    select: { code: true },
    take: MAX_INCLUDE_COMMON_CODES + 1,
  })
  if (own.length > MAX_INCLUDE_COMMON_CODES) {
    throw new BadRequestException(
      `includeCommon supports at most ${MAX_INCLUDE_COMMON_CODES} rows of the tenant; list without includeCommon`,
    )
  }

  return {
    OR: [
      { tenantCode, ...hideDeletedIn(tenantCode) },
      {
        tenantCode: commonTenantCode,
        code: { notIn: own.map((row: { code: string }) => row.code) },
        ...hideDeletedIn(commonTenantCode),
        // The common tenant's personal settings belong to its users, not to shared master data.
        ...(settings && { NOT: PERSONAL_SETTING_ROWS }),
      },
    ],
  }
}
