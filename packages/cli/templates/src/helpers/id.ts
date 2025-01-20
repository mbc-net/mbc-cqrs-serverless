import { KEY_SEPARATOR } from '@mbc-cqrs-serverless/core'

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
