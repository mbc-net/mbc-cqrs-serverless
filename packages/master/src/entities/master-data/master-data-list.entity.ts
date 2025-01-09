import { DataListEntity } from '@mbc-cqrs-serverless/core'
import { ApiProperty } from '@nestjs/swagger'

import { MasterDataEntity } from './master-data.entity'

export class MasterDataListEntity extends DataListEntity {
  @ApiProperty({ type: MasterDataEntity, isArray: true })
  items: MasterDataEntity[]

  constructor(partial: Partial<MasterDataListEntity>) {
    super(partial)

    Object.assign(this, partial)
  }
}
