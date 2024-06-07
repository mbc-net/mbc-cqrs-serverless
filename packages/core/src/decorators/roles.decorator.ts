import { SetMetadata } from '@nestjs/common'

import { ROLE_METADATA } from './constants'

export const Roles = (...roles: string[]) => SetMetadata(ROLE_METADATA, roles)
