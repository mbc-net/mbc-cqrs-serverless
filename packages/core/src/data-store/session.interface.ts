export interface SessionItem {
  /** pk: {userId}#{tenantCode} */
  pk: string
  /** sk: {moduleTableName}#{itemId} — module `tableName` from CommandModule */
  sk: string
  /** Version of the command — used to fetch exact command record */
  version: number
  /** Unix timestamp TTL — auto-expired by DynamoDB */
  ttl: number
}
