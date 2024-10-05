import { DataEntity } from '@mbc-cqrs-serverless/core'

import { SettingAttributes } from '../dto/setting-attributes.dto'

export class SettingDataEntity extends DataEntity {
  attributes: SettingAttributes

  constructor(partial: Partial<SettingDataEntity>) {
    super(partial)

    Object.assign(this, partial)
  }
}
