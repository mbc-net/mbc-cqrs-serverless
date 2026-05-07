import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator'

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
  // If omitted, the service downloads the ZIP from S3 and extracts CSV keys.
  // If provided, it must contain at least one key (empty [] is invalid).
  @IsArray()
  @IsOptional()
  @ArrayMinSize(1)
  sortedFileKeys?: string[]

  // High priority: tableName
  // If not provided, it will be extracted from the filename
  @IsString()
  @IsOptional()
  tableName?: string = null
}
