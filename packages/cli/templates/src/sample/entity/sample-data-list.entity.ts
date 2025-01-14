import { DataListEntity } from '@mbc-cqrs-serverless/core'

import { SampleDataEntity } from './sample-data.entity'

export class SampleDataListEntity extends DataListEntity {
  items: SampleDataEntity[]

  constructor(partial: Partial<SampleDataListEntity>) {
    super(partial)

    Object.assign(this, partial)
  }
}
