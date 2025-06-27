import { IsNumber, IsObject, IsOptional, IsString } from 'class-validator'

export class MasterDataCreateDto {
  @IsString()
  settingCode: string

  @IsString()
  name: string

  @IsOptional()
  @IsString()
  code?: string

  @IsNumber()
  @IsOptional()
  seq?: number

  @IsObject()
  attributes: object
}
