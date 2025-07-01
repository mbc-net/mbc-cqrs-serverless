import { CommandEntity } from '@mbc-cqrs-serverless/core'

export class MasterCommandEntity extends CommandEntity {
  attributes: Record<string, any>

  constructor(partial: Partial<MasterCommandEntity>) {
    super()

    Object.assign(this, partial)
  }
}
