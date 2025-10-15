import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator'

import { SurveyTemplateAttributes } from './survey-template-attributes.dto'

export class SurveyTemplateCreateDto {
  @ApiProperty({
    description: 'Name of the survey template',
    example: 'Customer Satisfaction Survey',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({
    description:
      'Survey template attributes including description and survey template structure',
    required: true,
  })
  @Type(() => SurveyTemplateAttributes)
  @ValidateNested()
  @IsNotEmpty()
  attributes: SurveyTemplateAttributes

  constructor(partial: Partial<SurveyTemplateCreateDto>) {
    Object.assign(this, partial)
  }
}
