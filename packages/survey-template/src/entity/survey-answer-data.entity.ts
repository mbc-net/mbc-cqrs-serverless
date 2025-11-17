import { DataEntity } from '@mbc-cqrs-serverless/core'

import { SurveyAnswerAttributes } from '../dto/survey-answer-attributes.dto'

export class SurveyAnswerDataEntity extends DataEntity {
  attributes: SurveyAnswerAttributes

  constructor(partial: Partial<SurveyAnswerDataEntity>) {
    super(partial)
    Object.assign(this, partial)
  }
}
