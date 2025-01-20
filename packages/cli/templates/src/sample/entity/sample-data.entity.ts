import { DataEntity } from '@mbc-cqrs-serverless/core'

import { SampleAttributes } from '../dto/sample-attributes.dto'

export class SampleDataEntity extends DataEntity {
  attributes: SampleAttributes

  constructor(partial: Partial<SampleDataEntity>) {
    super(partial)

    Object.assign(this, partial)
  }
}
