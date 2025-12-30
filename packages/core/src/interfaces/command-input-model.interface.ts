/**
 * Interface for complete command input data.
 * Used when creating or fully updating an entity.
 */
export interface CommandInputModel {
  /** Partition key. Format: {tenantCode}#{entityType} */
  pk: string
  /** Sort key. Format: {entityType}#{entityId} */
  sk: string // include version
  /** Unique entity identifier */
  id: string
  /** Business code */
  code: string
  /** Display name */
  name: string
  /** Version for optimistic locking */
  version: number
  /** Tenant code for isolation */
  tenantCode: string
  /** Entity type */
  type: string
  /** Soft delete flag */
  isDeleted?: boolean
  /** Sequence number */
  seq?: number
  /** Time-to-live in seconds */
  ttl?: number
  /** Custom attributes */
  attributes?: Record<string, any>
}

/**
 * Interface for partial command input data.
 * Used when updating only specific fields of an entity.
 * Requires pk, sk, and version for identification and locking.
 */
export interface CommandPartialInputModel extends Partial<CommandInputModel> {
  /** Partition key (required) */
  pk: string
  /** Sort key (required) */
  sk: string
  /** Version for optimistic locking (required) */
  version: number
}
