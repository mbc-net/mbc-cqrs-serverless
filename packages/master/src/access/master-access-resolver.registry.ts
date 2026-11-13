import { Injectable } from '@nestjs/common'

import { IMasterAccessResolver } from './master-access.interface'

@Injectable()
export class MasterAccessResolverRegistry {
  private resolver?: IMasterAccessResolver

  set(resolver: IMasterAccessResolver): void {
    if (this.resolver) {
      throw new Error(
        'Only one @MasterAccessResolver() is allowed per application',
      )
    }
    this.resolver = resolver
  }

  get(): IMasterAccessResolver | undefined {
    return this.resolver
  }
}
