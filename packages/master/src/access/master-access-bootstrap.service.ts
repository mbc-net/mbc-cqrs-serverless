import { ExplorerService } from '@mbc-cqrs-serverless/core'
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  Optional,
} from '@nestjs/common'
import { ModuleRef, ModulesContainer } from '@nestjs/core'

import { PRISMA_SERVICE } from '../master.module-definition'
import { IMasterAccessResolver } from './master-access.interface'
import { MASTER_ACCESS_RESOLVER_METADATA } from './master-access-resolver.decorator'
import { MasterAccessResolverRegistry } from './master-access-resolver.registry'

@Injectable()
export class MasterAccessBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MasterAccessBootstrapService.name)

  constructor(
    private readonly explorerService: ExplorerService,
    private readonly modulesContainer: ModulesContainer,
    private readonly moduleRef: ModuleRef,
    private readonly registry: MasterAccessResolverRegistry,
    @Optional() @Inject(PRISMA_SERVICE) private readonly prisma?: unknown,
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

    // ponytail: `_runtimeDataModel` is Prisma-internal (present in Prisma 5); the
    // warning below is the fallback if it moves.
    const fields = (
      this.prisma as
        | {
            _runtimeDataModel?: {
              models?: { Master?: { fields?: { name: string }[] } }
            }
          }
        | undefined
    )?._runtimeDataModel?.models?.Master?.fields
    if (!Array.isArray(fields)) {
      this.logger.warn(
        'Could not check whether the Prisma model Master has a systemId field.',
      )
    } else if (!fields.some((f) => f.name === 'systemId')) {
      throw new Error(
        'MasterAccessResolver is registered but the Prisma model Master has no systemId field. Add "systemId String? @map("system_id")" to the Master model and write systemId: getSystemId(cmd) in the master RDS handler before registering a resolver.',
      )
    }
  }
}
