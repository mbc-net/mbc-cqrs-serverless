import { CommandDto } from '@mbc-cqrs-serverless/core'
import { Type } from 'class-transformer'
import { IsOptional, ValidateNested } from 'class-validator'

import { SampleAttributes } from './sample-attributes.dto'

export class SampleCommandDto extends CommandDto {
  @Type(() => SampleAttributes)
  @ValidateNested()
  @IsOptional()
  attributes: SampleAttributes
}
