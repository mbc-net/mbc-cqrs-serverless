import { Injectable, OnApplicationBootstrap } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'

import { ExplorerService } from '../services/explorer.service'
import { IGroupRoleResolver } from './group-role-resolver.interface'
import { GroupRoleResolverRegistry } from './group-role-resolver.registry'

@Injectable()
export class AuthzBootstrapService implements OnApplicationBootstrap {
  constructor(
    private readonly explorerService: ExplorerService,
    private readonly moduleRef: ModuleRef,
    private readonly registry: GroupRoleResolverRegistry,
  ) {}

  onApplicationBootstrap(): void {
    const types = this.explorerService.exploreGroupRoleResolvers()

    if (types.length > 1) {
      throw new Error(
        'Only one @GroupRoleResolver() is allowed per application',
      )
    }

    if (types.length === 0) {
      return
    }

    const instance = this.moduleRef.get<IGroupRoleResolver>(types[0], {
      strict: false,
    })

    if (!instance) {
      throw new Error(
        `GroupRoleResolver ${types[0].name} was discovered but could not be resolved from DI`,
      )
    }

    this.registry.set(instance)
  }
}
