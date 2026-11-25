import { IGroupRoleResolver } from './group-role-resolver.interface'
import { GroupRoleResolverRegistry } from './group-role-resolver.registry'

describe('GroupRoleResolverRegistry', () => {
  it('should return undefined when empty', () => {
    const registry = new GroupRoleResolverRegistry()
    expect(registry.get()).toBeUndefined()
  })

  it('should store and return a resolver', () => {
    const registry = new GroupRoleResolverRegistry()
    const resolver: IGroupRoleResolver = {
      resolveRoles: async () => ['viewer'],
    }
    registry.set(resolver)
    expect(registry.get()).toBe(resolver)
  })

  it('should throw when setting a second resolver', () => {
    const registry = new GroupRoleResolverRegistry()
    registry.set({ resolveRoles: async () => [] })
    expect(() => registry.set({ resolveRoles: async () => [] })).toThrow(
      'Only one @GroupRoleResolver() is allowed per application',
    )
  })
})
