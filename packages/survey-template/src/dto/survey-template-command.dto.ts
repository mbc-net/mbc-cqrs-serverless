import { CommandDto } from '@mbc-cqrs-serverless/core'
import { Type } from 'class-transformer'
import { IsOptional, ValidateNested } from 'class-validator'

import { SurveyTemplateAttributes } from './survey-template-attributes.dto'

export class SurveyTemplateCommandDto extends CommandDto {
  @Type(() => SurveyTemplateAttributes)
  @ValidateNested()
  @IsOptional()
  attributes: SurveyTemplateAttributes

  constructor(partial: Partial<SurveyTemplateCommandDto>) {
    super()
    Object.assign(this, partial)
  }
}
