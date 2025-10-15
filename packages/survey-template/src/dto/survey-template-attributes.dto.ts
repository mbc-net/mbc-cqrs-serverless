import { ApiProperty } from '@nestjs/swagger'
import { IsObject, IsOptional, IsString } from 'class-validator'

export class SurveyTemplateAttributes {
  @ApiProperty({
    description: 'Description of the survey template',
    example: 'A comprehensive survey to measure customer satisfaction',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string

  @ApiProperty({
    description: 'The survey template structure as a JSON object',
    example: {
      id: 'svy_1759992461424',
      title: 'Untitled Survey',
      description: '',
      items: [
        {
          id: 'sec_1759992461424',
          type: 'section-header',
          title: 'First Section',
          description: '',
        },
        {
          id: 'q_1759992464085',
          type: 'short-text',
          label: '',
          validation: {
            required: false,
          },
        },
      ],
    },
    required: true,
  })
  @IsObject()
  surveyTemplate: object
}
