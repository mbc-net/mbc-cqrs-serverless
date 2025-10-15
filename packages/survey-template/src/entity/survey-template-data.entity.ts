import { DataEntity } from '@mbc-cqrs-serverless/core'

import { SurveyTemplateAttributes } from '../dto/survey-template-attributes.dto'

export class SurveyTemplateDataEntity extends DataEntity {
  attributes: SurveyTemplateAttributes

  constructor(partial: Partial<SurveyTemplateDataEntity>) {
    super(partial)

    Object.assign(this, partial)
  }
}
