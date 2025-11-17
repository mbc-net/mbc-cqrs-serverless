import { ApiProperty, PartialType } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'

import { SurveyTemplateAttributes } from './survey-template-attributes.dto'

export class UpdateSurveyTemplateAttributes extends PartialType(
  SurveyTemplateAttributes,
) {}

export class SurveyTemplateUpdateDto {
  @ApiProperty({
    description: 'Name of the survey template',
    example: 'Customer Satisfaction Survey',
    required: true,
  })
  @IsString()
  @IsOptional()
  name?: string

  @ApiProperty({
    description: 'Whether the survey template is deleted',
    example: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isDeleted?: boolean

  @ApiProperty({
    description:
      'Survey template attributes including description and survey template structure',
    required: true,
  })
  @Type(() => UpdateSurveyTemplateAttributes)
  @ValidateNested()
  @IsOptional()
  attributes?: UpdateSurveyTemplateAttributes

  constructor(partial: Partial<SurveyTemplateUpdateDto>) {
    Object.assign(this, partial)
  }
}
