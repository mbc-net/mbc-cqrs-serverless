import { IsObject, IsOptional, IsString } from 'class-validator'

export class MasterSettingUpdateDto {
  @IsString()
  @IsOptional()
  name?: string

  @IsObject()
  @IsOptional()
  attributes?: object
}
