import { KEY_SEPARATOR } from '@mbc-cqrs-serverless/core'
import { RotateByEnum } from '@mbc-cqrs-serverless/sequence'

import { MASTER_PK_PREFIX } from './key'

const genSequenceSk = (
  seqSettingCode: string,
  settingCode: string,
  rotateBy: RotateByEnum,
) =>
  `${seqSettingCode}${KEY_SEPARATOR}${settingCode}${KEY_SEPARATOR}${rotateBy}`

const sequencePk = (tenantCode: string) => `SEQ${KEY_SEPARATOR}${tenantCode}`

function generateMasterPk(tenantCode: string) {
  return `${MASTER_PK_PREFIX}${KEY_SEPARATOR}${tenantCode}`
}

function parsePk(pk: string): { type: string; tenantCode: string } {
  if (pk.split(KEY_SEPARATOR).length !== 2) {
    throw new Error('Invalid PK')
  }
  const [type, tenantCode] = pk.split(KEY_SEPARATOR)
  return {
    type,
    tenantCode,
  }
}
function parseId(masterId: string): { pk: string; sk: string } {
  const parts = masterId.split('#')

  if (parts.length < 4 || parts[0] !== 'MASTER') {
    throw new Error('Invalid masterId format')
  }

  const pk = `${parts[0]}#${parts[1]}`
  const sk = `${parts[2]}#${parts[3]}`

  return { pk, sk }
}

export { generateMasterPk, genSequenceSk, parseId, parsePk, sequencePk }
