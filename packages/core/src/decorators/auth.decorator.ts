import { applyDecorators, CanActivate, UseGuards } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiHeader,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'

import { HEADER_TENANT_CODE } from '../constants'
import { RolesGuard } from '../guard'
import { Roles } from './roles.decorator'

/**
 * Decorator that applies authentication and role-based access control.
 * Combines RolesGuard with Swagger documentation.
 *
 * @param roles - Required roles for access
 * @example
 * ```typescript
 * @Controller('orders')
 * export class OrderController {
 *   @Post()
 *   @Auth('admin', 'manager')
 *   createOrder() {}
 * }
 * ```
 */
export function Auth(...roles: string[]) {
  return AuthGuard({ roles })
}

export function AuthGuard({
  guard = RolesGuard,
  roles,
}: {
  // eslint-disable-next-line @typescript-eslint/ban-types
  guard?: CanActivate | Function
  roles: string[]
}) {
  return applyDecorators(
    Roles(...roles),
    UseGuards(guard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: 'Request unauthorized',
    }),
  )
}

/**
 * Decorator that adds tenant code header requirement to Swagger docs.
 */
export function HeaderTenant() {
  return ApiHeader({
    name: HEADER_TENANT_CODE,
    description: 'current working tenant code',
    required: true,
    allowEmptyValue: false,
    example: 'common',
  })
}
