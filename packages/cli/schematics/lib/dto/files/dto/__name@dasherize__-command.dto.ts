import { CommandDto } from '@mbc-cqrs-serverless/core'
import { Type } from 'class-transformer'
import { ValidateNested } from 'class-validator'

import { <%= classify(name) %>Attributes } from './<%= dasherize(name) %>-attributes.dto'

export class <%= classify(name) %>CommandDto extends CommandDto {
  @Type(() => <%= classify(name) %>Attributes)
  @ValidateNested()
  attributes: <%= classify(name) %>Attributes

  constructor(partial: Partial<<%= classify(name) %>CommandDto>) {
    super()
    Object.assign(this, partial)
  }
}
