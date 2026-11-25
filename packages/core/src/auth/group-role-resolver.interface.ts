import { JwtClaims } from '../context/invoke'

export interface TenantGroupMembership {
  tenant: string
  groups: string[]
}

export interface ResolveGroupRolesInput {
  tenantCode: string
  groupIds: string[]
  claims?: JwtClaims
}

export interface IGroupRoleResolver {
  resolveRoles(input: ResolveGroupRolesInput): Promise<string[]>
}
