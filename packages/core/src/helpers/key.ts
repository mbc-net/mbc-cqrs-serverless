import { DEFAULT_TENANT_CODE } from '../constants'
import { KEY_SEPARATOR, VER_SEPARATOR, VERSION_LATEST } from '../constants/key'

export function addSortKeyVersion(sk: string, version: number) {
  return `${removeSortKeyVersion(sk)}${VER_SEPARATOR}${version}`
}

export function getSortKeyVersion(sk: string) {
  const lastDivIdx = sk.lastIndexOf(VER_SEPARATOR)
  if (lastDivIdx === -1) {
    return VERSION_LATEST
  }
  return +sk.substring(lastDivIdx + 1)
}

export function removeSortKeyVersion(sk: string) {
  const lastDivIdx = sk.lastIndexOf(VER_SEPARATOR)
  if (lastDivIdx === -1) {
    return sk
  }
  return sk.substring(0, lastDivIdx)
}

export function generateId(pk: string, sk: string) {
  return `${pk}${KEY_SEPARATOR}${removeSortKeyVersion(sk)}`
}

/**
 * Inverse of {@link generateId}: extracts the base sort key from a composite id (`pk#skBase`).
 */
export function sortKeyBaseFromId(
  pk: string,
  itemId: string,
): string | undefined {
  const prefix = `${pk}${KEY_SEPARATOR}`
  if (!itemId.startsWith(prefix)) {
    return undefined
  }
  return itemId.slice(prefix.length)
}

/**
 * Parses a composite {@link generateId} when partition key is always
 * `{type}#{tenantCode}` (exactly two `#`-separated segments). The remainder of
 * `itemId` after that prefix is `skBase` (may contain `#`).
 */
export function parsePkSkFromId(
  itemId: string,
): { pk: string; skBase: string } | undefined {
  const parts = itemId.split(KEY_SEPARATOR)
  if (parts.length < 3) {
    return undefined
  }
  const pk = `${parts[0]}${KEY_SEPARATOR}${parts[1]}`
  const skBase = parts.slice(2).join(KEY_SEPARATOR)
  return { pk, skBase }
}

export function getTenantCode(pk: string) {
  const lastDivIdx = pk.lastIndexOf(KEY_SEPARATOR)
  if (lastDivIdx === -1) {
    return
  }
  return pk.substring(lastDivIdx + 1)
}

const S3_PREFIX = 's3://'
const S3_PREFIX_LEN = S3_PREFIX.length

export function isS3AttributeKey(attributes: any) {
  if (typeof attributes === 'string' && attributes.startsWith(S3_PREFIX)) {
    return true
  }
  return false
}

export function toS3AttributeKey(bucket: string, key: string) {
  return `${S3_PREFIX}${bucket}/${key}`
}

export function parseS3AttributeKey(s3Uri: string) {
  const sepIdx = s3Uri.indexOf('/', S3_PREFIX_LEN)
  const bucket = s3Uri.substring(S3_PREFIX_LEN, sepIdx)
  const key = s3Uri.substring(1 + sepIdx)

  return {
    bucket,
    key,
  }
}

export const masterPk = (tenantCode?: string) =>
  `MASTER${KEY_SEPARATOR}${tenantCode || DEFAULT_TENANT_CODE}`

export const seqPk = (tenantCode?: string) =>
  `SEQ${KEY_SEPARATOR}${tenantCode || DEFAULT_TENANT_CODE}`

export const ttlSk = (tableName: string) => `TTL${KEY_SEPARATOR}${tableName}`
