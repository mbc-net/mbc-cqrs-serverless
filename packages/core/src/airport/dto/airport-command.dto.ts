import { CommandDto } from '../../interfaces/command.dto'
import { Type } from 'class-transformer'
import { IsOptional, ValidateNested } from 'class-validator'

import { AirportAttributes } from './airport-attributes.dto'

export class AirportCommandDto extends CommandDto {
  @Type(() => AirportAttributes)
  @ValidateNested()
  @IsOptional()
  attributes: AirportAttributes
}
