import { CommandEntity } from '@mbc-cqrs-serverless/core'

import { SurveyTemplateAttributes } from '../dto/survey-template-attributes.dto'

export class SurveyTemplateCommandEntity extends CommandEntity {
  attributes: SurveyTemplateAttributes

  constructor(partial: Partial<SurveyTemplateCommandEntity>) {
    super()

    Object.assign(this, partial)
  }
}
