import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import {
  DEFAULT_COMMON_TENANT_CODES,
  DEFAULT_CROSS_TENANT_ROLES,
  ROLE_SYSTEM_ADMIN,
} from '../constants'
import {
  extractInvokeContext,
  getAuthorizerClaims,
  getUserContext,
  UserContext,
} from '../context'
import { ROLE_METADATA } from '../decorators'

@Injectable()
export class RolesGuard implements CanActivate {
  protected readonly logger = new Logger(RolesGuard.name)

  constructor(protected reflector: Reflector) {}

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

  /**
   * Verify tenant access.
   * This method checks if the user has valid tenant access, including
   * validation for header-based tenant override.
   */
  protected async verifyTenant(context: ExecutionContext): Promise<boolean> {
    const userContext = getUserContext(context)

    // Tenant code is required
    if (!userContext.tenantCode) {
      return false
    }

    // If tenant code comes from header (not from custom:tenant), verify permission
    if (this.isHeaderOverride(context, userContext)) {
      return this.canOverrideTenant(context, userContext)
    }

    return true
  }

  /**
   * Check if tenant code was provided via header override (no custom:tenant in JWT).
   * Override this method to customize header override detection logic.
   */
  protected isHeaderOverride(
    context: ExecutionContext,
    userContext: UserContext,
  ): boolean {
    const claims = this.getAuthorizerClaims(context)
    // If custom:tenant exists in JWT, it's not a header override
    return !claims['custom:tenant'] && !!userContext.tenantCode
  }

  /**
   * Check if user can override tenant via header.
   * Override this method to implement custom authorization logic for cross-tenant access.
   *
   * Default behavior:
   * - Allow access to common tenant codes (e.g., 'common')
   * - Allow users with cross-tenant roles (e.g., 'system_admin')
   */
  protected canOverrideTenant(
    context: ExecutionContext,
    userContext: UserContext,
  ): boolean {
    // Allow access to common tenant
    if (this.getCommonTenantCodes().includes(userContext.tenantCode)) {
      return true
    }

    // Allow users with cross-tenant roles
    return this.getCrossTenantRoles().includes(userContext.tenantRole)
  }

  /**
   * Get list of common tenant codes that anyone can access via header.
   * By default, reads from COMMON_TENANT_CODES environment variable (comma-separated).
   * Override this method to customize common tenant codes.
   *
   * Example override in application:
   * ```typescript
   * protected getCommonTenantCodes(): string[] {
   *   const codes = this.configService.get('COMMON_TENANT_CODES', 'common')
   *   return codes.split(',').map(c => c.trim())
   * }
   * ```
   */
  protected getCommonTenantCodes(): string[] {
    return DEFAULT_COMMON_TENANT_CODES
  }

  /**
   * Get list of roles that can perform cross-tenant operations via header override.
   * By default, reads from CROSS_TENANT_ROLES environment variable (comma-separated).
   * Override this method to customize cross-tenant roles.
   *
   * Example override in application:
   * ```typescript
   * protected getCrossTenantRoles(): string[] {
   *   const roles = this.configService.get('CROSS_TENANT_ROLES', 'system_admin,general_manager')
   *   return roles.split(',').map(r => r.trim())
   * }
   * ```
   */
  protected getCrossTenantRoles(): string[] {
    return DEFAULT_CROSS_TENANT_ROLES
  }

  /**
   * Get JWT authorizer claims from execution context.
   * This is a helper method that can be used by subclasses.
   */
  protected getAuthorizerClaims(context: ExecutionContext) {
    const invokeContext = extractInvokeContext(context)
    return getAuthorizerClaims(invokeContext)
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
    if (userRole === ROLE_SYSTEM_ADMIN) {
      return true
    }

    return requiredRoles.includes(userRole)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async getUserRole(context: ExecutionContext): Promise<string> {
    const userContext = getUserContext(context)

    return userContext.tenantRole
  }
}
