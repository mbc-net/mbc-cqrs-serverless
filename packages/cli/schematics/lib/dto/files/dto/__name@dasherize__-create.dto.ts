import { Type } from 'class-transformer'
import { IsOptional, IsString, ValidateNested } from 'class-validator'

import { <%= classify(name) %>Attributes } from './<%= dasherize(name) %>-attributes.dto'

export class <%= classify(name) %>CreateDto {
  @IsString()
  name: string

  @Type(() => <%= classify(name) %>Attributes)
  @ValidateNested()
  @IsOptional()
  attributes?: <%= classify(name) %>Attributes

  constructor(partial: Partial<<%= classify(name) %>CreateDto>) {
    Object.assign(this, partial)
  }
}
