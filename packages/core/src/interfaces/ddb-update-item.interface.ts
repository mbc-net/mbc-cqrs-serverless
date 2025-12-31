/**
 * DynamoDB Update Expression Types
 * @see https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.Modifying.html
 */

/** Primitive value types supported by DynamoDB */
export type DdbValueType = boolean | number | string | Record<string, any>

/** All DynamoDB value types including arrays */
export type DdbValueAllType = DdbValueType | DdbValueType[]

/**
 * Path-value pair for SET operations.
 * Used with if_not_exists() and list_append() functions.
 */
export type DdbUpdateSetPathValue = {
  /** Attribute path (e.g., 'attributes.count') */
  path: string
  /** Value to set */
  value: DdbValueAllType
}

/**
 * SET operation value with optional modifiers.
 * Supports atomic counters and list operations.
 */
export type DdbUpdateSetValue = {
  /** Increment numeric value by this amount */
  incrementBy?: number
  /** Decrement numeric value by this amount */
  decrementBy?: number
  /** Set value only if attribute doesn't exist */
  ifNotExists?: string | DdbUpdateSetPathValue
  /** Append to list attribute */
  listAppend?: string[] | DdbUpdateSetPathValue
}

/**
 * DynamoDB UpdateItem expression builder.
 * Provides type-safe interface for update operations.
 *
 * @example
 * const update: DdbUpdateItem = {
 *   set: { name: 'New Name', 'attributes.count': { incrementBy: 1 } },
 *   remove: { oldField: true }
 * }
 */
export interface DdbUpdateItem {
  /** SET expression - add or modify attributes */
  set?: Record<string, DdbValueAllType | DdbUpdateSetValue>
  /** REMOVE expression - delete attributes or list elements */
  remove?: Record<string, boolean | { index: number }>
  /** DELETE expression - remove elements from a set */
  delete?: Record<string, DdbValueType>
}
