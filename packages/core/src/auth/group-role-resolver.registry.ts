import { Injectable } from '@nestjs/common'

import { IGroupRoleResolver } from './group-role-resolver.interface'

@Injectable()
export class GroupRoleResolverRegistry {
  private resolver?: IGroupRoleResolver

  set(resolver: IGroupRoleResolver): void {
    if (this.resolver) {
      throw new Error(
        'Only one @GroupRoleResolver() is allowed per application',
      )
    }
    this.resolver = resolver
  }

  get(): IGroupRoleResolver | undefined {
    return this.resolver
  }
}
