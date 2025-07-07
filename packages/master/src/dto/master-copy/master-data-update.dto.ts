import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator'

export class MasterDataUpdateDto {
  @IsString()
  @IsOptional()
  name?: string

  @IsBoolean()
  @IsOptional()
  isDeleted?: boolean

  @IsNumber()
  @IsOptional()
  seq?: number

  @IsObject()
  @IsOptional()
  attributes?: object
}
