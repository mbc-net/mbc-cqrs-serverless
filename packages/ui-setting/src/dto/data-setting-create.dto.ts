import { IsObject, IsOptional, IsString } from 'class-validator'

export class CreateDataSettingDto {
  @IsString()
  settingCode: string

  @IsString()
  name: string

  @IsString()
  code: string

  @IsObject()
  @IsOptional()
  attributes?: object
}
