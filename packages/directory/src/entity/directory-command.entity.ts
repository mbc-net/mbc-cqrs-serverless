import { CommandEntity } from '@mbc-cqrs-serverless/core'

import { DirectoryAttributes } from '../dto/directory-attributes.dto'

export class DirectoryCommandEntity extends CommandEntity {
  attributes: DirectoryAttributes

  constructor(partial: Partial<DirectoryCommandEntity>) {
    super()
    Object.assign(this, partial)
  }
}
