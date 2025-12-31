import { IsObject, IsOptional, IsString } from 'class-validator'

export class CreateImportDto {
  @IsString()
  @IsOptional()
  sourceId?: string

  @IsString()
  tableName: string

  @IsString()
  tenantCode: string

  @IsString()
  @IsOptional()
  name?: string

  @IsObject()
  attributes: Record<string, any>

  // S3 key: only exist when processing a CSV file
  @IsString()
  @IsOptional()
  s3Key?: string
}
