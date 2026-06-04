import { DetailKey, KEY_SEPARATOR } from '@mbc-cqrs-serverless/core'

export function parsePk(pk: string): { type: string; tenantCode: string } {
  if (pk.split(KEY_SEPARATOR).length !== 2) {
    throw new Error('Invalid PK')
  }
  const [type, tenantCode] = pk.split(KEY_SEPARATOR)
  return {
    type,
    tenantCode,
  }
}

export function parseId(id: string): DetailKey {
  const parts = id.split(KEY_SEPARATOR)
  if (parts.length < 3) {
    throw new Error(`Invalid ID: ${id}`)
  }
  const pk = `${parts[0]}${KEY_SEPARATOR}${parts[1]}` // type#tenantCode
  const sk = parts.slice(2).join(KEY_SEPARATOR) // remain parts
  return { pk, sk }
}
