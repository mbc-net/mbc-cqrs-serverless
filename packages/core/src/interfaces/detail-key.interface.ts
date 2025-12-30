/**
 * Interface for DynamoDB composite key.
 * Used to identify items in the data store.
 */
export interface DetailKey {
  /** Partition key */
  pk: string
  /** Sort key */
  sk: string
}
