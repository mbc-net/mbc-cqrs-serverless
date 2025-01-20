import { DataEntity } from '@mbc-cqrs-serverless/core'

import { <%= classify(name) %>Attributes } from '../dto/<%= dasherize(name) %>-attributes.dto'

export class <%= classify(name) %>DataEntity extends DataEntity {
  attributes: <%= classify(name) %>Attributes

  constructor(partial: Partial<<%= classify(name) %>DataEntity>) {
    super(partial)
    Object.assign(this, partial)
  }
}
