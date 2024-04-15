import { DataListEntity } from '@mbc-cqrs-severless/core'
import { ApiProperty } from '@nestjs/swagger'

import { SettingCommandEntity } from './setting-command.entity'

export class SettingDataListEntity extends DataListEntity {
  @ApiProperty({ type: SettingCommandEntity, isArray: true })
  items: SettingCommandEntity[]

  constructor(partial: Partial<SettingDataListEntity>) {
    super(partial)

    Object.assign(this, partial)
  }
}
