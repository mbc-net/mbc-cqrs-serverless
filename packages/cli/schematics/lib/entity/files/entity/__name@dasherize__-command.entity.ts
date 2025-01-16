import { CommandEntity } from '@mbc-cqrs-serverless/core'

import { <%= classify(name) %>Attributes } from '../dto/<%= dasherize(name) %>-attributes.dto'

export class <%= classify(name) %>CommandEntity extends CommandEntity {
  attributes: <%= classify(name) %>Attributes

  constructor(partial: Partial<<%= classify(name) %>CommandEntity>) {
    super()
    Object.assign(this, partial)
  }
}
