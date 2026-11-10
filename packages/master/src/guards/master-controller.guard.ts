import {
  getUserContext,
  GroupRoleResolverRegistry,
  ROLE_SYSTEM_ADMIN,
  RolesGuard,
} from '@mbc-cqrs-serverless/core'
import { ExecutionContext, Inject, Injectable, Optional } from '@nestjs/common'
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
    const { read, write } = this.options?.controllerAuth ?? {}
    const requiredRoles = this.isRead(context)
      ? (read ?? [])
      : (write ?? [ROLE_SYSTEM_ADMIN])
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

  private isRead(context: ExecutionContext): boolean {
    const route = this.reflector.getAllAndOverride<MasterRouteOptions>(
      MASTER_ROUTE_METADATA,
      [context.getHandler(), context.getClass()],
    )
    const { method } = context.switchToHttp().getRequest()
    return method === 'GET' || !!route?.read
  }
}
