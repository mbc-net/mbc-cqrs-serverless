import { applyDecorators, Injectable, SetMetadata } from '@nestjs/common'

export const MASTER_ACCESS_RESOLVER_METADATA = 'master:access-resolver'

/**
 * Marks a class as the application's `IMasterAccessResolver` (exactly one per app).
 * Discovered at bootstrap and registered in `MasterAccessResolverRegistry`.
 *
 * Applies `@Injectable()` with default (singleton) scope. Do **not** add `@Injectable()`
 * on the same class.
 */
export function MasterAccessResolver(): ClassDecorator {
  return applyDecorators(
    SetMetadata(MASTER_ACCESS_RESOLVER_METADATA, true),
    Injectable(),
  ) as ClassDecorator
}
