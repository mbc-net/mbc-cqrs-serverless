import {
  CommandModel,
  CommandService,
  DEFAULT_COMMON_TENANT_CODES,
  DEFAULT_CROSS_TENANT_ROLES,
  getAuthorizerClaims,
  getUserContext,
  GroupRoleResolverRegistry,
  IInvoke,
} from '@mbc-cqrs-serverless/core'
import {
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common'

import { generateMasterPk, generateMasterSettingSk } from '../helpers'
import {
  MasterModuleOptions,
  MODULE_OPTIONS_TOKEN,
} from '../master.module-definition'
import {
  MASTER_SYSTEM_SHARED,
  MasterAccessAction,
  MasterAccessGrant,
  MasterAccessOptions,
  MasterAccessResult,
  MasterAccessTarget,
} from './master-access.interface'
import { MasterAccessResolverRegistry } from './master-access-resolver.registry'

@Injectable()
export class MasterAccessService {
  private readonly grantCache = new WeakMap<
    IInvoke,
    Promise<MasterAccessGrant[]>
  >()

  constructor(
    private readonly registry: MasterAccessResolverRegistry,
    private readonly commandService: CommandService,
    @Optional() private readonly groupRoleRegistry?: GroupRoleResolverRegistry,
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly moduleOptions?: MasterModuleOptions,
  ) {}

  isEnabled(): boolean {
    return !!this.registry.get()
  }

  async getAccess(options: {
    invokeContext: IInvoke
  }): Promise<MasterAccessResult> {
    if (!this.isEnabled()) {
      return { enabled: false, grants: [] }
    }
    if (!getUserContext(options.invokeContext).userId) {
      return { enabled: true, grants: [] }
    }
    return {
      enabled: true,
      grants: await this.loadGrants(options.invokeContext, undefined),
    }
  }

  callerTenant(options: MasterAccessOptions): string {
    const { invokeContext, scope } = options
    if (!invokeContext || !getUserContext(invokeContext).userId) {
      return scope?.tenantCode
    }
    return getUserContext(invokeContext).tenantCode
  }

  async assertAccess(
    target: MasterAccessTarget,
    action: MasterAccessAction,
    options: MasterAccessOptions,
  ): Promise<void> {
    if (!this.isEnabled() || options.skipAccessCheck) {
      return
    }
    this.gate(target.tenantCode, action, options)

    const { scope } = options
    if (
      scope?.tenantCode &&
      !this.tenantAllowed(target.tenantCode, scope.tenantCode, action)
    ) {
      this.deny()
    }
    const owner = (target.systemId ?? MASTER_SYSTEM_SHARED).toLowerCase()
    if (scope?.systemId && owner !== scope.systemId.toLowerCase()) {
      this.deny()
    }

    const grants = await this.loadGrants(
      options.invokeContext,
      scope?.tenantCode,
    )
    const allowed = grants.some(
      (g) =>
        (g.systemId === '*' || g.systemId.toLowerCase() === owner) &&
        (g.settingCode === '*' || g.settingCode === target.settingCode) &&
        (action === 'read' ? g.read || g.write : g.write),
    )
    if (!allowed) {
      this.deny()
    }
  }

  async assertTenant(
    tenantCode: string,
    action: MasterAccessAction,
    options: MasterAccessOptions,
  ): Promise<void> {
    if (!this.isEnabled() || options.skipAccessCheck) {
      return
    }
    this.gate(tenantCode, action, options)
    const { scope } = options
    if (
      scope?.tenantCode &&
      !this.tenantAllowed(tenantCode, scope.tenantCode, action)
    ) {
      this.deny()
    }
  }

  assertCrossTenant(options: MasterAccessOptions): void {
    if (!this.isEnabled() || options.skipAccessCheck) {
      return
    }
    if (!options.invokeContext || !this.isCrossTenant(options.invokeContext)) {
      this.deny()
    }
  }

  /** Tenant setting first, then the common tenant's. A soft-deleted setting still counts. */
  async getEffectiveSetting(
    tenantCode: string,
    settingCode: string,
  ): Promise<CommandModel | null> {
    const common = this.commonTenantCodes()[0]
    const tenants = [tenantCode]
    if (common.toLowerCase() !== tenantCode.toLowerCase()) {
      tenants.push(common)
    }
    for (const tenant of tenants) {
      const item = await this.commandService.getLatestItem({
        pk: generateMasterPk(tenant),
        sk: generateMasterSettingSk(settingCode),
      })
      if (item) {
        return item
      }
    }
    return null
  }

  /** Tenant gate, the anonymous rules, shared by assertAccess and assertTenant. */
  private gate(
    tenantCode: string,
    action: MasterAccessAction,
    options: MasterAccessOptions,
  ): void {
    const { invokeContext, scope } = options
    if (!invokeContext) {
      this.deny()
    }
    const anonymous = !getUserContext(invokeContext).userId
    if (
      !this.tenantAllowed(tenantCode, this.callerTenant(options), action) &&
      (anonymous || !this.isCrossTenant(invokeContext))
    ) {
      this.deny()
    }
    if (anonymous && (action === 'write' || !scope?.tenantCode)) {
      this.deny()
    }
  }

  /** The target tenant equals the expected one, or is a common tenant being read. */
  private tenantAllowed(
    target: string,
    expected: string | undefined,
    action: MasterAccessAction,
  ): boolean {
    const code = target?.toLowerCase()
    return (
      !!code &&
      (code === expected?.toLowerCase() ||
        (action === 'read' && this.commonTenantCodes().includes(code)))
    )
  }

  private commonTenantCodes(): string[] {
    return [
      this.moduleOptions?.commonTenantCode ?? 'common',
      ...DEFAULT_COMMON_TENANT_CODES,
    ].map((c) => c.toLowerCase())
  }

  private isCrossTenant(invokeContext: IInvoke): boolean {
    return DEFAULT_CROSS_TENANT_ROLES.includes(
      getUserContext(invokeContext).tenantRole,
    )
  }

  private loadGrants(
    invokeContext: IInvoke,
    anonymousTenant: string | undefined,
  ): Promise<MasterAccessGrant[]> {
    let pending = this.grantCache.get(invokeContext)
    if (!pending) {
      pending = this.resolve(invokeContext, anonymousTenant)
      this.grantCache.set(invokeContext, pending)
    }
    return pending
  }

  private async resolve(
    invokeContext: IInvoke,
    anonymousTenant: string | undefined,
  ): Promise<MasterAccessGrant[]> {
    const user = getUserContext(invokeContext)
    const claims = getAuthorizerClaims(invokeContext)
    const roles = [...user.tenantRoles]
    const groupResolver = this.groupRoleRegistry?.get()
    if (groupResolver && user.tenantGroupIds.length) {
      const groupRoles = await groupResolver.resolveRoles({
        tenantCode: user.tenantCode,
        groupIds: user.tenantGroupIds,
        claims,
      })
      for (const role of groupRoles) {
        if (!roles.includes(role)) roles.push(role)
      }
    }
    return this.registry.get().resolveGrants({
      userId: user.userId,
      tenantCode: user.userId ? user.tenantCode : anonymousTenant,
      roles: user.userId ? roles : [],
      claims,
    })
  }

  private deny(): never {
    throw new ForbiddenException('Access to this master data is not allowed')
  }
}
