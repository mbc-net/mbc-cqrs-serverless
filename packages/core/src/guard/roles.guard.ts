import { getCurrentInvoke } from '@codegenie/serverless-express'
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { Role } from '../constants'
import { getUserContext } from '../context'
import { ROLE_METADATA } from '../decorators'

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name)

  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // check tenant
    const allowedTenant = await this.verifyTenant(context)
    if (!allowedTenant) {
      return false
    }

    // check role permissions
    const allowedRole = await this.verifyRole(context)
    return allowedRole
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async verifyTenant(context: ExecutionContext): Promise<boolean> {
    // Get tenant code from header
    const userContext = getUserContext()

    // required tenant code
    return !!userContext.tenantCode
  }

  protected async verifyRole(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLE_METADATA,
      [context.getHandler(), context.getClass()],
    )
    if (!requiredRoles || !requiredRoles.length) {
      // all user can access
      return true
    }

    const userRole = await this.getUserRole(context)
    if (!userRole) {
      return false
    }
    if (userRole === Role.SUPER_ADMIN) {
      return true
    }

    return requiredRoles.includes(userRole)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async getUserRole(context: ExecutionContext): Promise<string> {
    const { event, context: ctx } = getCurrentInvoke()
    this.logger.debug('event:', event)
    this.logger.debug('context: ', ctx)
    const userContext = getUserContext(event)

    const userRole = userContext.superRole || userContext.role

    // setAuthorizerContext(event, 'role', userRole)

    return userRole
  }
}
