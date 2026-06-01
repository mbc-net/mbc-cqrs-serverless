import { Global, Module } from '@nestjs/common'

import { RolesGuard } from '../guard/roles.guard'
import { ExplorerService } from '../services/explorer.service'
import { AuthzBootstrapService } from './authz-bootstrap.service'
import { GroupRoleResolverRegistry } from './group-role-resolver.registry'

@Global()
@Module({
  providers: [
    ExplorerService,
    GroupRoleResolverRegistry,
    AuthzBootstrapService,
    RolesGuard,
  ],
  exports: [GroupRoleResolverRegistry, RolesGuard, ExplorerService],
})
export class AuthModule {}
