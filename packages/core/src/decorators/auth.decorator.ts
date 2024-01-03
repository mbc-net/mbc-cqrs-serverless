import { applyDecorators, UseGuards } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiHeader,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'

import { RolesGuard } from '../guard'
import { Roles } from './roles.decorator'

export function Auth(...roles: string[]) {
  return applyDecorators(
    Roles(...roles),
    UseGuards(RolesGuard),
    ApiBearerAuth(),
    ApiHeader({
      name: 'x-tenant-code',
      description: 'current working tenant code',
      required: true,
      allowEmptyValue: false,
      example: 'common',
    }),
    ApiUnauthorizedResponse({
      description: 'Request unauthorized',
    }),
  )
}
