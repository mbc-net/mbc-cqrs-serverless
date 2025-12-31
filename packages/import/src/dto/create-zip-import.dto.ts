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

  // High priority: sortedFileKeys
  // If not provided, it will use the default sorting logic
  @IsArray()
  @IsOptional()
  sortedFileKeys?: string[]

  // High priority: tableName
  // If not provided, it will be extracted from the filename
  @IsString()
  @IsOptional()
  tableName?: string = null
}
