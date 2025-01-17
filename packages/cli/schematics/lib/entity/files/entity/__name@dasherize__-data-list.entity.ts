import { DataListEntity } from '@mbc-cqrs-serverless/core'

import { <%= classify(name) %>DataEntity } from './<%= dasherize(name) %>-data.entity'

export class <%= classify(name) %>DataListEntity extends DataListEntity {
  items: <%= classify(name) %>DataEntity[]

  constructor(partial: Partial<<%= classify(name) %>DataListEntity>) {
    super(partial)
    Object.assign(this, partial)
  }
}
