import { IsObject, IsOptional, IsString } from 'class-validator'

export class CreateMasterDataDto {
  @IsString()
  tenantCode: string

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
