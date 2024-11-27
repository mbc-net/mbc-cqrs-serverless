import { DEFAULT_TENANT_CODE } from '../constants'
import { KEY_SEPARATOR, VER_SEPARATOR } from '../constants/key'

export function addSortKeyVersion(sk: string, version: number) {
  return `${removeSortKeyVersion(sk)}${VER_SEPARATOR}${version}`
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
