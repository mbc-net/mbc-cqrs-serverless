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
