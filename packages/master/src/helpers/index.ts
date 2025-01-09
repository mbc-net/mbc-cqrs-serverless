import { KEY_SEPARATOR, removeSortKeyVersion } from '@mbc-cqrs-serverless/core'

import {
  DATA_SK_PREFIX,
  MASTER_PK_PREFIX,
  SETTING_SK_PREFIX,
} from '../constants'

export function generateMasterPk(tenantCode: string) {
  return `${MASTER_PK_PREFIX}${KEY_SEPARATOR}${tenantCode}`
}

export function generateMasterDataSk(settingCode: string, code: string) {
  return `${DATA_SK_PREFIX}${KEY_SEPARATOR}${settingCode}${KEY_SEPARATOR}${code}`
}

export function generateMasterSettingSk(code: string) {
  return `${SETTING_SK_PREFIX}${KEY_SEPARATOR}${code}`
}

export function parseDataSettingSk(sk: string): {
  settingCode: string
  code: string
} {
  if (sk.split(KEY_SEPARATOR).length !== 2) {
    throw new Error('Invalid SK')
  }
  const [settingCode, code] = removeSortKeyVersion(sk).split(KEY_SEPARATOR)
  return { settingCode, code }
}

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
