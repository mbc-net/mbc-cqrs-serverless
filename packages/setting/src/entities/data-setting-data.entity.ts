import { DataEntity } from '@mbc-cqrs-sererless/core'

export class DataSettingDataEntity extends DataEntity {
  attributes?: object

  constructor(partial: Partial<DataSettingDataEntity>) {
    super(partial)

    Object.assign(this, partial)
  }
}
