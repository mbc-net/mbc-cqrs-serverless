import { Injectable } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { Test, TestingModule } from '@nestjs/testing'

import { GroupRoleResolver } from '../decorators'
import { ExplorerService } from '../services/explorer.service'
import { AuthzBootstrapService } from './authz-bootstrap.service'
import { IGroupRoleResolver } from './group-role-resolver.interface'
import { GroupRoleResolverRegistry } from './group-role-resolver.registry'

@GroupRoleResolver()
@Injectable()
class TestResolver implements IGroupRoleResolver {
  async resolveRoles() {
    return ['viewer']
  }
}

describe('AuthzBootstrapService', () => {
  it('should register one resolver on bootstrap', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthzBootstrapService,
        GroupRoleResolverRegistry,
        ExplorerService,
        TestResolver,
      ],
    }).compile()

    const bootstrap = moduleRef.get(AuthzBootstrapService)
    const registry = moduleRef.get(GroupRoleResolverRegistry)
    bootstrap.onApplicationBootstrap()
    expect(registry.get()).toBeInstanceOf(TestResolver)
  })

  it('should throw when more than one resolver exists', async () => {
    @GroupRoleResolver()
    @Injectable()
    class SecondResolver implements IGroupRoleResolver {
      async resolveRoles() {
        return []
      }
    }

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthzBootstrapService,
        GroupRoleResolverRegistry,
        ExplorerService,
        TestResolver,
        SecondResolver,
      ],
    }).compile()

    const bootstrap = moduleRef.get(AuthzBootstrapService)
    expect(() => bootstrap.onApplicationBootstrap()).toThrow(
      /Only one @GroupRoleResolver/,
    )
  })

  it('should throw when resolver type is discovered but DI returns no instance', async () => {
    class UnregisteredResolver implements IGroupRoleResolver {
      async resolveRoles() {
        return []
      }
    }

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthzBootstrapService,
        GroupRoleResolverRegistry,
        {
          provide: ExplorerService,
          useValue: {
            exploreGroupRoleResolvers: () => [UnregisteredResolver],
          },
        },
        {
          provide: ModuleRef,
          useValue: {
            get: () => undefined,
          },
        },
      ],
    }).compile()

    const bootstrap = moduleRef.get(AuthzBootstrapService)

    expect(() => bootstrap.onApplicationBootstrap()).toThrow(
      /could not be resolved from DI/,
    )
  })
})
