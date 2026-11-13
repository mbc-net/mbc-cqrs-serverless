import { ExplorerService } from '@mbc-cqrs-serverless/core'
import { Logger } from '@nestjs/common'

import { MasterAccessBootstrapService } from './master-access-bootstrap.service'
import { MasterAccessResolverRegistry } from './master-access-resolver.registry'

class ResolverA {}
class ResolverB {}

const model = (names: string[]) => ({
  _runtimeDataModel: {
    models: { Master: { fields: names.map((name) => ({ name })) } },
  },
})

const build = (types: any[], instance: any = {}, prisma?: any) => {
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
    prisma,
  )
  return { service, registry, moduleRef }
}

describe('MasterAccessBootstrapService', () => {
  let warn: jest.SpyInstance
  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation()
  })
  afterEach(() => warn.mockRestore())

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

  it('throws when a resolver is registered and Master has no systemId', () => {
    const { service } = build(
      [ResolverA],
      { resolveGrants: jest.fn() },
      model(['id', 'code']),
    )
    expect(() => service.onApplicationBootstrap()).toThrow(/no systemId field/)
  })

  it('starts when Master has systemId', () => {
    const { service, registry } = build(
      [ResolverA],
      { resolveGrants: jest.fn() },
      model(['id', 'systemId']),
    )
    service.onApplicationBootstrap()
    expect(registry.get()).toBeDefined()
  })

  it('warns and starts when the model list cannot be read', () => {
    const { service } = build([ResolverA], { resolveGrants: jest.fn() }, {})
    expect(() => service.onApplicationBootstrap()).not.toThrow()
    expect(warn).toHaveBeenCalled()
  })

  it('checks nothing without a resolver', () => {
    const { service } = build([], {}, model(['id']))
    expect(() => service.onApplicationBootstrap()).not.toThrow()
  })
})
