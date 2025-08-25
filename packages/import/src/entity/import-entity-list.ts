import { DataListEntity } from '@mbc-cqrs-serverless/core'

import { ImportEntity } from './import-entity'

export class ImportListEntity extends DataListEntity {
  items: ImportEntity[]

  constructor(partial: Partial<ImportListEntity>) {
    super(partial)

    Object.assign(this, partial)
  }
}
