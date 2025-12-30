import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateZipImportDto {
  @IsString()
  @IsNotEmpty()
  bucket: string

  @IsString()
  @IsNotEmpty()
  key: string

  @IsString()
  @IsNotEmpty()
  tenantCode: string

  @IsArray()
  @IsOptional()
  sortedFileKeys?: string[]
}
