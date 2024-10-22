import { PartialType } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'

import { SettingAttributes } from './setting-attributes.dto'

export class UpdateSettingAttributes extends PartialType(SettingAttributes) {}

export class UpdateSettingDto {
  @IsString()
  @IsOptional()
  name?: string

  @IsBoolean()
  @IsOptional()
  isDelete?: boolean

  @Type(() => UpdateSettingAttributes)
  @ValidateNested()
  @IsOptional()
  attributes?: UpdateSettingAttributes
}
