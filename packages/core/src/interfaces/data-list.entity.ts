import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

import { DataEntity } from './data.entity'

export class DataListEntity {
  @ApiPropertyOptional()
  total?: number
  @ApiPropertyOptional()
  lastSk?: string
  @ApiProperty({
    type: [DataEntity],
  })
  items: DataEntity[]

  constructor(data: Partial<DataListEntity>) {
    Object.assign(this, data)
  }
}
