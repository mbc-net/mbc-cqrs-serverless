import { DataEntity } from '@mbc-cqrs-sererless/core'

import { MasterAttributes } from '../dto/master-attributes.dto'

export class MasterDataEntity extends DataEntity {
  attributes: MasterAttributes

  constructor(partial: Partial<MasterDataEntity>) {
    super(partial)

    Object.assign(this, partial)
  }
}
