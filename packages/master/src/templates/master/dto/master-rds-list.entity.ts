import { ApiProperty } from '@nestjs/swagger'

import { MasterRdsEntity } from './master-rds.entity'

export class MasterRdsListEntity {
  @ApiProperty({ type: Number })
  total?: number

  @ApiProperty({ type: MasterRdsEntity, isArray: true })
  items: MasterRdsEntity[]

  constructor(data: Partial<MasterRdsListEntity>) {
    Object.assign(this, data)
  }
}
