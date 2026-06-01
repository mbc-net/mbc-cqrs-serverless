import { applyDecorators, Injectable, SetMetadata } from '@nestjs/common'

import { GROUP_ROLE_RESOLVER_METADATA } from './constants'

/**
 * Marks a class as the application's IGroupRoleResolver (exactly one per app).
 * Discovered at bootstrap and registered in GroupRoleResolverRegistry.
 */
export function GroupRoleResolver(): ClassDecorator {
  return applyDecorators(
    SetMetadata(GROUP_ROLE_RESOLVER_METADATA, true),
    Injectable(),
  ) as ClassDecorator
}
