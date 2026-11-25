import { Test } from '@nestjs/testing'

import { RolesGuard } from '../guard'
import { AuthModule } from './auth.module'
import { GroupRoleResolverRegistry } from './group-role-resolver.registry'

describe('AuthModule', () => {
  it('should export GroupRoleResolverRegistry globally for RolesGuard', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile()

    const registry = moduleRef.get(GroupRoleResolverRegistry)
    const guard = moduleRef.get(RolesGuard)

    expect(registry).toBeInstanceOf(GroupRoleResolverRegistry)
    expect(guard).toBeInstanceOf(RolesGuard)
    expect(
      (guard as RolesGuard & { registry?: GroupRoleResolverRegistry }).registry,
    ).toBe(registry)
  })
})
