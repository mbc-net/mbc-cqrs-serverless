import { CommandEntity } from '@mbc-cqrs-serverless/core'

import { SampleAttributes } from '../dto/sample-attributes.dto'

export class SampleCommandEntity extends CommandEntity {
  attributes: SampleAttributes

  constructor(partial: Partial<SampleCommandEntity>) {
    super()

    Object.assign(this, partial)
  }
}
