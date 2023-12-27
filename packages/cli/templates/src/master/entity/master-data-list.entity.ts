import { DataListEntity } from '@mbc-cqrs-severless/core'

import { MasterDataEntity } from './master-data.entity'

export class MasterDataListEntity extends DataListEntity {
  items: MasterDataEntity[]

  constructor(partial: Partial<MasterDataListEntity>) {
    super(partial)

    Object.assign(this, partial)
  }
}
