export const MASTER_SYSTEM_ATTRIBUTE = '__systemId'

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Read the owning system from a row's attributes, or undefined if none. */
export function getSystemId(
  row?: { attributes?: unknown } | null,
): string | undefined {
  const attributes = row?.attributes
  if (!isObject(attributes)) return undefined
  const value = attributes[MASTER_SYSTEM_ATTRIBUTE]
  return typeof value === 'string' ? value : undefined
}

/** Remove the reserved key from attributes. */
export function stripSystemAttribute<T>(attributes: T): T {
  if (!isObject(attributes)) return attributes
  const rest = { ...attributes }
  delete rest[MASTER_SYSTEM_ATTRIBUTE]
  return rest as T
}

/** Set the owner on attributes, overwriting any client-supplied value. */
export function withSystemAttribute<T>(attributes: T, systemId?: string): T {
  if (systemId === undefined) return attributes
  return {
    ...(isObject(attributes) ? attributes : {}),
    [MASTER_SYSTEM_ATTRIBUTE]: systemId,
  } as T
}

/**
 * Move the owner out of attributes to a top-level `systemId`.
 * A row without the reserved key is returned unchanged (same reference),
 * so an RDS row's own `systemId` column (possibly null) is left alone.
 */
export function toPublicRow<
  T extends { attributes?: unknown; systemId?: string | null },
>(row: T): T {
  const owner = getSystemId(row)
  if (owner === undefined) return row
  return {
    ...row,
    attributes: stripSystemAttribute(row.attributes),
    systemId: row.systemId ?? owner,
  }
}
