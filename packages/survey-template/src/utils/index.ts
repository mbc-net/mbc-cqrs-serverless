import { KEY_SEPARATOR } from '@mbc-cqrs-serverless/core'

export enum SortOrder {
  asc = 'asc',
  desc = 'desc',
}

function parsePk(pk: string): { type: string; tenantCode: string } {
  if (pk.split(KEY_SEPARATOR).length !== 2) {
    throw new Error('Invalid PK')
  }
  const [type, tenantCode] = pk.split(KEY_SEPARATOR)
  return {
    type,
    tenantCode,
  }
}

function getOrderBy(order: string) {
  let orderValue: SortOrder = SortOrder.asc,
    orderKey = order
  if (order.startsWith('-')) {
    orderValue = SortOrder.desc
    orderKey = order.slice(1)
  }

  return { [orderKey]: orderValue }
}

function getOrderBys<T>(orders: string[]): T[] {
  if (!orders) {
    return undefined
  }
  return orders.map((order) => getOrderBy(order)) as T[]
}

export { getOrderBy, getOrderBys, parsePk }
