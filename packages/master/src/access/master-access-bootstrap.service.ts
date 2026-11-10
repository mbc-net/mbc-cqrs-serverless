import { ExplorerService } from '@mbc-cqrs-serverless/core'
import { Injectable, OnApplicationBootstrap } from '@nestjs/common'
import { ModuleRef, ModulesContainer } from '@nestjs/core'

import { IMasterAccessResolver } from './master-access.interface'
import { MASTER_ACCESS_RESOLVER_METADATA } from './master-access-resolver.decorator'
import { MasterAccessResolverRegistry } from './master-access-resolver.registry'

@Injectable()
export class MasterAccessBootstrapService implements OnApplicationBootstrap {
  constructor(
    private readonly explorerService: ExplorerService,
    private readonly modulesContainer: ModulesContainer,
    private readonly moduleRef: ModuleRef,
    private readonly registry: MasterAccessResolverRegistry,
  ) {}

  onApplicationBootstrap(): void {
    const types = this.explorerService.flatMap<IMasterAccessResolver>(
      [...this.modulesContainer.values()],
      (instance) =>
        this.explorerService.filterProvider(
          instance,
          MASTER_ACCESS_RESOLVER_METADATA,
        ),
    )

    if (types.length > 1) {
      throw new Error(
        'Only one @MasterAccessResolver() is allowed per application',
      )
    }
    if (types.length === 0) {
      return
    }

    const instance = this.moduleRef.get<IMasterAccessResolver>(types[0], {
      strict: false,
    })
    if (!instance) {
      throw new Error(
        `MasterAccessResolver ${types[0].name} was discovered but could not be resolved from DI`,
      )
    }
    this.registry.set(instance)
  }
}
