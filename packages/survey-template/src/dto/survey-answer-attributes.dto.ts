import { IsEmail, IsObject, IsOptional, IsString } from 'class-validator'

export class SurveyAnswerAttributes {
  @IsString()
  surveyId: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsObject()
  answer: object
}
