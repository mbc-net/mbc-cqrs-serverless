import { DataListEntity } from '@mbc-cqrs-serverless/core'

import { DirectoryDataEntity } from './directory-data.entity'

export class DirectoryDataListEntity extends DataListEntity {
  items: DirectoryDataEntity[]

  constructor(partial: Partial<DirectoryDataListEntity>) {
    super(partial)
    Object.assign(this, partial)
  }
}
