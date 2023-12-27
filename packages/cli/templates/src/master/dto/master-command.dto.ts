import { CommandDto } from '@mbc-cqrs-severless/core'
import { Type } from 'class-transformer'
import { IsOptional, ValidateNested } from 'class-validator'

import { MasterAttributes } from './master-attributes.dto'

export class MasterCommandDto extends CommandDto {
  @Type(() => MasterAttributes)
  @ValidateNested()
  @IsOptional()
  attributes: MasterAttributes
}
