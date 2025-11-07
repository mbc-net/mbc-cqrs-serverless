import { Type } from 'class-transformer'
import { IsOptional, IsString, ValidateNested } from 'class-validator'

import { DirectoryAttributes } from './directory-attributes.dto'

export class DirectoryCreateDto {
  @IsString()
  name: string

  @IsString()
  type: string

  @Type(() => DirectoryAttributes)
  @ValidateNested()
  @IsOptional()
  attributes?: DirectoryAttributes

  constructor(partial: Partial<DirectoryCreateDto>) {
    Object.assign(this, partial)
  }
}
