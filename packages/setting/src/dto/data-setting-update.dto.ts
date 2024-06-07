import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator'

export class UpdateDataSettingDto {
  @IsString()
  @IsOptional()
  name?: string

  @IsBoolean()
  @IsOptional()
  isDeleted?: boolean

  @IsObject()
  @IsOptional()
  attributes?: object
}
