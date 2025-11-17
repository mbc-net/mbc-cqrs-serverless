import { DataListEntity } from '@mbc-cqrs-serverless/core'

import { SurveyAnswerDataEntity } from './survey-answer-data.entity'

export class SurveyAnswerDataListEntity extends DataListEntity {
  items: SurveyAnswerDataEntity[]

  constructor(partial: Partial<SurveyAnswerDataListEntity>) {
    super(partial)
    Object.assign(this, partial)
  }
}
