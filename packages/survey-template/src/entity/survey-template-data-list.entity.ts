import { DataListEntity } from '@mbc-cqrs-serverless/core'
import { ApiProperty } from '@nestjs/swagger'

import { SurveyTemplateDataEntity } from './survey-template-data.entity'

export class SurveyTemplateDataListEntity extends DataListEntity {
  @ApiProperty({ type: SurveyTemplateDataEntity, isArray: true })
  items: SurveyTemplateDataEntity[]

  constructor(partial: Partial<SurveyTemplateDataListEntity>) {
    super(partial)

    Object.assign(this, partial)
  }
}
