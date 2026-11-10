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
 * override or hide a common row).
 */
export async function buildTenantScope(
  prisma: any,
  input: {
    tenantCode: string
    commonTenantCode: string
    masterType: string
    masterTypeCode?: string
    includeCommon?: boolean
  },
): Promise<Record<string, unknown>> {
  const { tenantCode, commonTenantCode, masterType, masterTypeCode } = input
  if (
    !input.includeCommon ||
    tenantCode?.toLowerCase() === commonTenantCode?.toLowerCase()
  ) {
    return { tenantCode }
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
      { tenantCode },
      {
        tenantCode: commonTenantCode,
        code: { notIn: own.map((row: { code: string }) => row.code) },
      },
    ],
  }
}
