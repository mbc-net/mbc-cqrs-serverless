import { CommandDto } from '@mbc-cqrs-severless/core'
import { IsObject, IsOptional } from 'class-validator'

export class DataSettingCommandDto extends CommandDto {
  @IsObject()
  @IsOptional()
  attributes?: object
}
