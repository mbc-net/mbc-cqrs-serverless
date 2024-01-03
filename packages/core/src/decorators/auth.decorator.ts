import { applyDecorators, UseGuards } from '@nestjs/common'
import { ApiSecurity, ApiUnauthorizedResponse } from '@nestjs/swagger'

import { RolesGuard } from '../guard'
import { Roles } from './roles.decorator'

export function Auth(...roles: string[]) {
  return applyDecorators(
    Roles(...roles),
    UseGuards(RolesGuard),
    ApiSecurity('Api-Key'),
    ApiUnauthorizedResponse({
      description: 'Request unauthorized',
    }),
  )
}
