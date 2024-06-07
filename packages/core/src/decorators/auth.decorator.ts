import { applyDecorators, CanActivate, UseGuards } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiHeader,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'

import { HEADER_TENANT_CODE } from '../constants'
import { RolesGuard } from '../guard'
import { Roles } from './roles.decorator'

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

export function HeaderTenant() {
  return ApiHeader({
    name: HEADER_TENANT_CODE,
    description: 'current working tenant code',
    required: true,
    allowEmptyValue: false,
    example: 'common',
  })
}
