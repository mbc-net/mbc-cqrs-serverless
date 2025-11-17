import { CommandEntity } from '@mbc-cqrs-serverless/core'

import { SurveyAnswerAttributes } from '../dto/survey-answer-attributes.dto'

export class SurveyAnswerCommandEntity extends CommandEntity {
  attributes: SurveyAnswerAttributes

  constructor(partial: Partial<SurveyAnswerCommandEntity>) {
    super()
    Object.assign(this, partial)
  }
}
