import { SetMetadata } from '@nestjs/common'

import { ROLE_METADATA } from './constants'

/**
 * Decorator that sets required roles for route access.
 * Used with RolesGuard to enforce role-based access control.
 *
 * @param roles - List of allowed roles
 * @example
 * ```typescript
 * @Get()
 * @Roles('admin', 'manager')
 * findAll() {}
 * ```
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLE_METADATA, roles)
