import {
  CommandModel,
  CommandService,
  DataModel,
  DEFAULT_COMMON_TENANT_CODES,
  DEFAULT_CROSS_TENANT_ROLES,
  getAuthorizerClaims,
  getUserContext,
  GroupRoleResolverRegistry,
  IInvoke,
} from '@mbc-cqrs-serverless/core'
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common'

import {
  generateMasterPk,
  generateMasterSettingSk,
  getSystemId,
} from '../helpers'
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
    object,
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
    const common = this.moduleOptions?.commonTenantCode ?? 'common'
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

  /**
   * Prisma condition limiting a list to the rows the caller may read, or undefined when nothing
   * needs limiting. The search value and scope.systemId narrow it; both set and different match
   * nothing.
   */
  async buildListFilter(
    kind: 'setting' | 'data',
    options: MasterAccessOptions,
    searchSystemId?: string,
  ): Promise<Record<string, unknown> | undefined> {
    if (!this.isEnabled() || options.skipAccessCheck) {
      return undefined
    }
    const none = { id: { in: [] } }
    const search = searchSystemId?.trim() || undefined
    const scoped = options.scope?.systemId || undefined
    if (search && scoped && search.toLowerCase() !== scoped.toLowerCase()) {
      return none
    }
    const narrow = scoped ?? search

    const grants = await this.loadGrants(
      options.invokeContext,
      options.scope?.tenantCode,
    )
    const codeKey = kind === 'setting' ? 'masterCode' : 'masterTypeCode'
    const conditions: Record<string, unknown>[] = []
    for (const g of grants) {
      if (!(g.read || g.write)) continue
      if (
        narrow &&
        g.systemId !== '*' &&
        g.systemId.toLowerCase() !== narrow.toLowerCase()
      ) {
        continue
      }
      const system = narrow ?? g.systemId
      const condition: Record<string, unknown> = {}
      if (system.toLowerCase() === MASTER_SYSTEM_SHARED) {
        condition.OR = [{ systemId: MASTER_SYSTEM_SHARED }, { systemId: null }]
      } else if (system !== '*') {
        condition.systemId = system
      }
      if (g.settingCode !== '*') {
        condition[codeKey] = g.settingCode
      }
      if (!Object.keys(condition).length) {
        return undefined
      }
      conditions.push(condition)
    }
    if (!conditions.length) return none
    return conditions.length === 1 ? conditions[0] : { OR: conditions }
  }

  /**
   * Work out the owner to store on a setting write and assert write access to it.
   * Returns undefined when access control is disabled.
   */
  async prepareSettingOwner(
    input: {
      tenantCode: string
      code: string
      requested?: string
      existing?: DataModel | null
    },
    options: MasterAccessOptions,
  ): Promise<string | undefined> {
    if (!this.isEnabled()) {
      return undefined
    }
    const { tenantCode, code, existing } = input
    // A blank systemId ('' or null) counts as absent.
    const requested = input.requested || undefined
    const conflict = () =>
      new BadRequestException(
        `systemId of setting ${code} cannot be changed or set to a different value`,
      )
    let owner: string | undefined
    if (existing) {
      owner = getSystemId(existing)
      if (requested !== undefined && requested !== owner) throw conflict()
    } else {
      const inherited = getSystemId(
        await this.getEffectiveSetting(tenantCode, code),
      )
      if (
        inherited !== undefined &&
        requested !== undefined &&
        requested !== inherited
      ) {
        throw conflict()
      }
      owner = inherited ?? requested ?? options.systemId
    }
    await this.assertAccess(
      { tenantCode, systemId: owner, settingCode: code },
      'write',
      options,
    )
    return owner
  }

  /**
   * Work out the owner to store on a data row write and assert write access to it.
   * The row keeps its own owner, else options.systemId, else its setting's owner.
   * Returns undefined when access control is disabled.
   */
  async prepareDataOwner(
    input: {
      tenantCode: string
      settingCode: string
      existing?: DataModel | null
    },
    options: MasterAccessOptions,
  ): Promise<string | undefined> {
    if (!this.isEnabled()) {
      return undefined
    }
    const { tenantCode, settingCode, existing } = input
    let owner = getSystemId(existing) ?? (options.systemId || undefined)
    if (owner === undefined) {
      const setting = await this.getEffectiveSetting(tenantCode, settingCode)
      if (!setting && !existing) {
        throw new BadRequestException(`Setting not found: ${settingCode}`)
      }
      owner = getSystemId(setting)
    }
    await this.assertAccess(
      { tenantCode, systemId: owner, settingCode },
      'write',
      options,
    )
    return owner
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
    // Without a custom:tenant claim the tenant comes from x-tenant-code, which
    // RolesGuard may not have validated; accept it like RolesGuard.canOverrideTenant.
    if (
      !anonymous &&
      !getAuthorizerClaims(invokeContext)['custom:tenant'] &&
      !this.commonTenantCodes().includes(
        getUserContext(invokeContext).tenantCode?.toLowerCase(),
      ) &&
      !this.isCrossTenant(invokeContext)
    ) {
      this.deny()
    }
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
    // On Lambda one invoke object is reused across invocations; its event is per request.
    const key: object = invokeContext.event ?? invokeContext
    let pending = this.grantCache.get(key)
    if (!pending) {
      pending = this.resolve(invokeContext, anonymousTenant)
      this.grantCache.set(key, pending)
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
