import { CommandEntity } from '@mbc-cqrs-serverless/core'

import { MasterAttributes } from '../dto/master-attributes.dto'

export class MasterCommandEntity extends CommandEntity {
  attributes: MasterAttributes

  constructor(partial: Partial<MasterCommandEntity>) {
    super()

    Object.assign(this, partial)
  }
}
