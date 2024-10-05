import { CommandDto } from '@mbc-cqrs-serverless/core'
import { Type } from 'class-transformer'
import { IsOptional, ValidateNested } from 'class-validator'

import { SettingAttributes } from './setting-attributes.dto'

export class SettingCommandDto extends CommandDto {
  @Type(() => SettingAttributes)
  @ValidateNested()
  @IsOptional()
  attributes: SettingAttributes

  constructor(partial: Partial<SettingCommandDto>) {
    super()
    Object.assign(this, partial)
  }
}
