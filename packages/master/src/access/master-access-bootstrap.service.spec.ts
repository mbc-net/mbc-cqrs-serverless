import { ExplorerService } from '@mbc-cqrs-serverless/core'

import { MasterAccessBootstrapService } from './master-access-bootstrap.service'
import { MasterAccessResolverRegistry } from './master-access-resolver.registry'

class ResolverA {}
class ResolverB {}

const build = (types: any[], instance: any = {}) => {
  const explorer = {
    flatMap: jest.fn().mockReturnValue(types),
    filterProvider: jest.fn(),
  } as unknown as ExplorerService
  const moduleRef = { get: jest.fn().mockReturnValue(instance) }
  const modulesContainer = new Map()
  const registry = new MasterAccessResolverRegistry()
  const service = new MasterAccessBootstrapService(
    explorer,
    modulesContainer as any,
    moduleRef as any,
    registry,
  )
  return { service, registry, moduleRef }
}

describe('MasterAccessBootstrapService', () => {
  it('stays disabled with no resolver', () => {
    const { service, registry } = build([])
    service.onApplicationBootstrap()
    expect(registry.get()).toBeUndefined()
  })

  it('registers the single resolver', () => {
    const resolver = { resolveGrants: jest.fn() }
    const { service, registry } = build([ResolverA], resolver)
    service.onApplicationBootstrap()
    expect(registry.get()).toBe(resolver)
  })

  it('throws when two resolvers are registered', () => {
    const { service } = build([ResolverA, ResolverB])
    expect(() => service.onApplicationBootstrap()).toThrow(
      'Only one @MasterAccessResolver() is allowed per application',
    )
  })

  it('throws when the resolver cannot be resolved from DI', () => {
    const { service } = build([ResolverA], null)
    expect(() => service.onApplicationBootstrap()).toThrow(
      /could not be resolved/,
    )
  })
})
