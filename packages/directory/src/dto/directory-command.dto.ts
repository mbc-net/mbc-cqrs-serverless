import { CommandDto } from '@mbc-cqrs-serverless/core'
import { Type } from 'class-transformer'
import { ValidateNested } from 'class-validator'

import { DirectoryAttributes } from './directory-attributes.dto'

export class DirectoryCommandDto extends CommandDto {
  @Type(() => DirectoryAttributes)
  @ValidateNested()
  attributes: DirectoryAttributes

  constructor(partial: Partial<DirectoryCommandDto>) {
    super()
    Object.assign(this, partial)
  }
}
