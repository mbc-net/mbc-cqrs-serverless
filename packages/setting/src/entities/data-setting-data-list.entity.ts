import { DataListEntity } from '@mbc-cqrs-serverless/core'
import { ApiProperty } from '@nestjs/swagger'

import { DataSettingDataEntity } from './data-setting-data.entity'

export class DataSettingDataListEntity extends DataListEntity {
  @ApiProperty({ type: DataSettingDataEntity, isArray: true })
  items: DataSettingDataEntity[]

  constructor(partial: Partial<DataSettingDataListEntity>) {
    super(partial)

    Object.assign(this, partial)
  }
}
