import { DataListEntity } from '@mbc-cqrs-serverless/core'
import { ApiProperty } from '@nestjs/swagger'

import { SettingDataEntity } from './setting-data.entity'

export class SettingDataListEntity extends DataListEntity {
  @ApiProperty({ type: SettingDataEntity, isArray: true })
  items: SettingDataEntity[]

  constructor(partial: Partial<SettingDataListEntity>) {
    super(partial)

    Object.assign(this, partial)
  }
}
