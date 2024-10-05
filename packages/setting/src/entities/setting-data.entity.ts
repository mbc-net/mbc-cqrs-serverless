import { DataEntity } from '@mbc-cqrs-sererless/core'

import { SettingAttributes } from '../dto/setting-attributes.dto'

export class SettingDataEntity extends DataEntity {
  attributes: SettingAttributes

  constructor(partial: Partial<SettingDataEntity>) {
    super(partial)

    Object.assign(this, partial)
  }
}
