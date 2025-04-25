import { IsNumber, IsObject, IsOptional, IsString } from 'class-validator'

export class CreateMasterDataDto {
  @IsString()
  tenantCode: string

  @IsString()
  settingCode: string

  @IsString()
  name: string

  @IsString()
  code: string

  @IsNumber()
  @IsOptional()
  seq?: number

  @IsObject()
  @IsOptional()
  attributes?: object
}
