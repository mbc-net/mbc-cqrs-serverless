import {
  getUserContext,
  GroupRoleResolverRegistry,
  ROLE_SYSTEM_ADMIN,
  RolesGuard,
} from '@mbc-cqrs-serverless/core'
import {
  BadRequestException,
  ExecutionContext,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import {
  MasterModuleOptions,
  MODULE_OPTIONS_TOKEN,
} from '../master.module-definition'
import {
  MASTER_ROUTE_METADATA,
  MasterRouteOptions,
} from './master-route.decorator'

/**
 * Opt-in guard for the built-in master routes. Without `controllerAuth` it lets
 * every request through, exactly as before.
 */
@Injectable()
export class MasterControllerGuard extends RolesGuard {
  constructor(
    reflector: Reflector,
    @Optional() registry?: GroupRoleResolverRegistry,
    @Optional()
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options?: MasterModuleOptions,
  ) {
    super(reflector, registry)
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.options?.controllerAuth) {
      return true
    }
    if (!this.getAuthorizerClaims(context)?.sub) {
      return false
    }
    return super.canActivate(context)
  }

  protected async verifyRole(context: ExecutionContext): Promise<boolean> {
    if (this.getRoute(context)?.systemAdminOnly) {
      return getUserContext(context).tenantRoles.includes(ROLE_SYSTEM_ADMIN)
    }
    const { read, write } = this.options?.controllerAuth ?? {}
    const requiredRoles = this.isRead(context)
      ? (read ?? [])
      : write?.length
        ? write
        : [ROLE_SYSTEM_ADMIN]
    if (!requiredRoles.length) {
      return true
    }
    const { tenantRoles, tenantGroupIds } = getUserContext(context)
    if (
      tenantRoles.includes(ROLE_SYSTEM_ADMIN) ||
      this.hasAnyRole(requiredRoles, tenantRoles)
    ) {
      return true
    }
    const groupRoles = await this.resolveGroupRoles(context, tenantGroupIds)
    return this.hasAnyRole(requiredRoles, groupRoles)
  }

  /**
   * Rejects a request that names a tenant other than the caller's, unless it
   * only reads a common tenant or the caller has a cross-tenant role.
   */
  protected async verifyTenant(context: ExecutionContext): Promise<boolean> {
    if (!(await super.verifyTenant(context))) {
      return false
    }
    const { params, query, body } = context.switchToHttp().getRequest()
    const read = this.isRead(context)
    const common = (this.options?.commonTenantCode ?? 'common').toLowerCase()
    const named: { tenant: unknown; read: boolean }[] = []
    const segment = (value: unknown) => {
      const parts = typeof value === 'string' ? value.split('#') : []
      return parts.length < 2 ? undefined : parts[1]
    }
    if (params?.pk !== undefined) {
      named.push({ tenant: segment(params.pk), read })
    }
    if (params?.id !== undefined) {
      named.push({ tenant: segment(params.id), read })
    }
    if (body?.tenantCode !== undefined) {
      named.push({ tenant: body.tenantCode, read })
    }
    if (query?.tenantCode !== undefined) {
      named.push({ tenant: query.tenantCode, read })
    }
    if (body?.masterSettingId !== undefined) {
      named.push({ tenant: segment(body.masterSettingId), read: true })
    }
    if (body?.targetTenants !== undefined) {
      if (!Array.isArray(body.targetTenants)) {
        throw new BadRequestException('Invalid tenant code')
      }
      body.targetTenants.forEach((tenant: unknown) =>
        named.push({ tenant, read: false }),
      )
    }
    if (this.getRoute(context)?.targetsCommon) {
      named.push({ tenant: common, read: false })
    }

    const { tenantCode, tenantRole } = getUserContext(context)
    const commons = [...this.getCommonTenantCodes(), common].map((c) =>
      c.toLowerCase(),
    )
    const crossTenant = this.getCrossTenantRoles().includes(tenantRole)
    for (const { tenant, read: isReadOnly } of named) {
      if (typeof tenant !== 'string' || !tenant) {
        throw new BadRequestException('Invalid tenant code')
      }
      const code = tenant.toLowerCase()
      if (
        code !== tenantCode &&
        !crossTenant &&
        !(isReadOnly && commons.includes(code))
      ) {
        throw new BadRequestException('Invalid tenant code')
      }
    }
    return true
  }

  private getRoute(context: ExecutionContext): MasterRouteOptions | undefined {
    return this.reflector.getAllAndOverride<MasterRouteOptions>(
      MASTER_ROUTE_METADATA,
      [context.getHandler(), context.getClass()],
    )
  }

  private isRead(context: ExecutionContext): boolean {
    const { method } = context.switchToHttp().getRequest()
    return method === 'GET' || !!this.getRoute(context)?.read
  }
}
