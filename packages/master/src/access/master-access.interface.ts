import { IInvoke, JwtClaims } from '@mbc-cqrs-serverless/core'

/** Owner assumed for a row that carries no system id. */
export const MASTER_SYSTEM_SHARED = 'shared'

export type MasterAccessAction = 'read' | 'write'

export interface MasterAccessGrant {
  /** System the grant applies to, or '*' for every system. */
  systemId: string
  /** Setting code the grant applies to, or '*' for every setting. */
  settingCode: string
  read: boolean
  write: boolean
}

export interface ResolveMasterAccessInput {
  userId?: string
  tenantCode: string
  roles: string[]
  claims?: JwtClaims
}

export interface IMasterAccessResolver {
  resolveGrants(input: ResolveMasterAccessInput): Promise<MasterAccessGrant[]>
}

export interface MasterAccessResult {
  enabled: boolean
  grants: MasterAccessGrant[]
}

export interface MasterAccessTarget {
  tenantCode: string
  systemId?: string
  settingCode: string
}

export interface MasterAccessOptions {
  invokeContext?: IInvoke
  scope?: { tenantCode?: string; systemId?: string }
  skipAccessCheck?: boolean
  systemId?: string
}

export type MasterWriteOptions = MasterAccessOptions & {
  invokeContext: IInvoke
}
