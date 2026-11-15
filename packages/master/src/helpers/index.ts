import {
  KEY_SEPARATOR,
  removeSortKeyVersion,
  VER_SEPARATOR,
} from '@mbc-cqrs-serverless/core'
import { RotateByEnum } from '@mbc-cqrs-serverless/sequence/dist'
import { BadRequestException } from '@nestjs/common'

import { MASTER_PK_PREFIX, SETTING_SK_PREFIX } from '../constants'
import { SettingTypeEnum } from '../enums'

export function generateMasterPk(tenantCode: string) {
  return `${MASTER_PK_PREFIX}${KEY_SEPARATOR}${tenantCode}`
}

/** Prisma `where` entries matching group and user (personal) setting rows by their key. */
export const PERSONAL_SETTING_ROWS = [
  SettingTypeEnum.TENANT_GROUP,
  SettingTypeEnum.TENANT_USER,
].map((type) => ({
  sk: {
    startsWith: `${SETTING_SK_PREFIX}${KEY_SEPARATOR}${type}${KEY_SEPARATOR}`,
  },
}))

/**
 * A key segment is non-empty and holds neither `#` nor `@`. A `#` splits it into two segments,
 * and the command service cuts a sort key at its last `@` (the version separator), so either
 * one makes the stored key differ from the one that was checked.
 */
export function isValidKeySegment(value: string): boolean {
  return (
    !!value && !value.includes(KEY_SEPARATOR) && !value.includes(VER_SEPARATOR)
  )
}

/** A sort key the command service stores unchanged: it holds no version separator `@`. */
export function assertUnversionedSk(sk: string): void {
  if (sk.includes(VER_SEPARATOR)) {
    throw new BadRequestException(`Invalid key: ${sk}`)
  }
}

/**
 * A setting code must be one key segment and not the setting prefix. Otherwise it builds the
 * key of another row: `USER#u1#S1` as a setting code is a user's personal row, and
 * `MASTER_SETTING` as a data settingCode is the setting rows themselves.
 */
export function assertValidSettingCode(code: string): void {
  if (!isValidKeySegment(code) || code === SETTING_SK_PREFIX) {
    throw new BadRequestException(`Invalid settingCode: ${code}`)
  }
}

/** A master data code is the second and last key segment: non-empty, without `#` or `@`. */
export function assertValidDataCode(code: string): void {
  if (!isValidKeySegment(code)) {
    throw new BadRequestException(`Invalid code: ${code}`)
  }
}

/** The userId or groupId of a personal setting key is one key segment, like the code after it. */
export function assertValidPersonalId(id: string): void {
  if (!isValidKeySegment(id)) {
    throw new BadRequestException(`Invalid user or group id: ${id}`)
  }
}

export function generateMasterDataSk(settingCode: string, code: string) {
  return `${settingCode}${KEY_SEPARATOR}${code}`
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

export function parseId(masterId: string): { pk: string; sk: string } {
  const parts = masterId.split('#')

  if (parts.length < 4 || parts[0] !== 'MASTER') {
    throw new Error('Invalid masterId format')
  }

  const pk = `${parts[0]}#${parts[1]}`
  const sk = `${parts[2]}#${parts[3]}`

  return { pk, sk }
}

/** Last segment for a MASTER_SETTING key (also personal ones), first segment otherwise. */
export function getSettingCodeFromSk(sk: string): string {
  const parts = removeSortKeyVersion(sk).split(KEY_SEPARATOR)
  return parts[0] === SETTING_SK_PREFIX ? parts[parts.length - 1] : parts[0]
}

/** A MASTER_SETTING key with more than two segments, e.g. MASTER_SETTING#USER#u1#CODE. */
export function isPersonalSettingSk(sk: string): boolean {
  const parts = sk.split(KEY_SEPARATOR)
  return parts[0] === SETTING_SK_PREFIX && parts.length > 2
}

export const genSequenceSk = (
  seqSettingCode: string,
  settingCode: string,
  rotateBy: RotateByEnum,
) =>
  `${seqSettingCode}${KEY_SEPARATOR}${settingCode}${KEY_SEPARATOR}${rotateBy}`

export const sequencePk = (tenantCode: string) =>
  `SEQ${KEY_SEPARATOR}${tenantCode}`

export * from './system-attribute'
