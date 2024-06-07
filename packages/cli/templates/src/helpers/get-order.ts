import { Prisma } from '@prisma/client'

export function getOrderBy(order: string) {
  let orderValue: Prisma.SortOrder = Prisma.SortOrder.asc,
    orderKey = order
  if (order.startsWith('-')) {
    orderValue = Prisma.SortOrder.desc
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
