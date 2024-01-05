import { ApiProperty } from '@nestjs/swagger'

import { DataEntity } from './data.entity'

export class DataListEntity {
  @ApiProperty()
  total?: number
  @ApiProperty()
  lastSk?: string
  @ApiProperty()
  items: DataEntity[]

  constructor(data: Partial<DataListEntity>) {
    Object.assign(this, data)
  }
}
