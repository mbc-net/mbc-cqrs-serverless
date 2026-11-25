import { IGroupRoleResolver } from '../../auth/group-role-resolver.interface'
import { GroupRoleResolver } from '../../decorators'

@GroupRoleResolver()
export class MockGroupRoleResolver implements IGroupRoleResolver {
  async resolveRoles() {
    return []
  }
}
