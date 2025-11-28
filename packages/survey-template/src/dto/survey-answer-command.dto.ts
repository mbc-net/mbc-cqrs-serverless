import { CommandDto } from '@mbc-cqrs-serverless/core'
import { Type } from 'class-transformer'
import { ValidateNested } from 'class-validator'

import { SurveyAnswerAttributes } from './survey-answer-attributes.dto'

export class SurveyAnswerCommandDto extends CommandDto {
  @Type(() => SurveyAnswerAttributes)
  @ValidateNested()
  attributes: SurveyAnswerAttributes

  constructor(partial: Partial<SurveyAnswerCommandDto>) {
    super()
    Object.assign(this, partial)
  }
}
