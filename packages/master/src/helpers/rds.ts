import { SETTING_SK_PREFIX } from '../constants'

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

  const own = await prisma.master.findMany({
    where: {
      tenantCode,
      masterType,
      ...(masterTypeCode && { masterTypeCode }),
    },
    select: { code: true },
  })

  return {
    OR: [
      { tenantCode, ...hideDeletedIn(tenantCode) },
      {
        tenantCode: commonTenantCode,
        code: { notIn: own.map((row: { code: string }) => row.code) },
        ...hideDeletedIn(commonTenantCode),
      },
    ],
  }
}
