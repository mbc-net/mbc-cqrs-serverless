import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  ValidateNested,
} from 'class-validator'

import { CommonSettingDto } from './common-setting-create.dto'

export class CommonSettingBulkDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommonSettingDto)
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  items: CommonSettingDto[]
}
