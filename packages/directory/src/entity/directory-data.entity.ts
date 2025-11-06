import { DataEntity } from '@mbc-cqrs-serverless/core'

import { DirectoryAttributes } from '../dto/directory-attributes.dto'

export class DirectoryDataEntity extends DataEntity {
  attributes: DirectoryAttributes

  constructor(partial: Partial<DirectoryDataEntity>) {
    super(partial)
    Object.assign(this, partial)
  }
}
