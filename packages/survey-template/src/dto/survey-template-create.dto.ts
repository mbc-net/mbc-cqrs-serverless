import { ApiProperty, PickType } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator'

import { SurveyTemplateAttributes } from './survey-template-attributes.dto'

export class CreateSurveyTemplateAttributes extends PickType(
  SurveyTemplateAttributes,
  ['surveyTemplate', 'description'],
) {}

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
  @Type(() => CreateSurveyTemplateAttributes)
  @ValidateNested()
  @IsNotEmpty()
  attributes: CreateSurveyTemplateAttributes

  constructor(partial: Partial<SurveyTemplateCreateDto>) {
    Object.assign(this, partial)
  }
}
