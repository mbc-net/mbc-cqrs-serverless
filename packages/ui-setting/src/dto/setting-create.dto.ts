import { Type } from 'class-transformer'
import { IsString, ValidateNested } from 'class-validator'

import { SettingAttributes } from './setting-attributes.dto'

export class CreateSettingAttributes extends SettingAttributes {}

export class CreateSettingDto {
  @IsString()
  name: string

  @IsString()
  code: string

  @Type(() => CreateSettingAttributes)
  @ValidateNested()
  attributes: CreateSettingAttributes
}
