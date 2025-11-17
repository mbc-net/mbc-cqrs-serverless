import { Type } from 'class-transformer'
import { ValidateNested } from 'class-validator'

import { SurveyAnswerAttributes } from './survey-answer-attributes.dto'

export class SurveyAnswerCreateDto {
  @Type(() => SurveyAnswerAttributes)
  @ValidateNested()
  attributes: SurveyAnswerAttributes

  constructor(partial: Partial<SurveyAnswerCreateDto>) {
    Object.assign(this, partial)
  }
}
