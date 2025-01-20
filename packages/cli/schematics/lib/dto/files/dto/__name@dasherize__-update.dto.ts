import { PartialType } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'

import { <%= classify(name) %>Attributes } from './<%= dasherize(name) %>-attributes.dto'

export class <%= classify(name) %>UpdateAttributes extends PartialType(<%= classify(name) %>Attributes) {}

export class <%= classify(name) %>UpdateDto {
  @IsString()
  @IsOptional()
  name?: string

  @IsBoolean()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsOptional()
  isDeleted?: boolean

  @Type(() => <%= classify(name) %>UpdateAttributes)
  @ValidateNested()
  @IsOptional()
  attributes?: <%= classify(name) %>UpdateAttributes

  constructor(partial: Partial<<%= classify(name) %>UpdateDto>) {
    Object.assign(this, partial)
  }
}
