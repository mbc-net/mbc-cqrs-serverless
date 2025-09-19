import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator'

import { ProcessingMode } from '../enum'

export class CreateCsvImportDto {
  @IsString()
  @IsOptional()
  sourceId?: string

  @IsNotEmpty()
  @IsEnum(ProcessingMode)
  processingMode: ProcessingMode

  @IsString()
  @IsNotEmpty()
  bucket: string

  @IsString()
  @IsNotEmpty()
  key: string

  @IsString()
  @IsNotEmpty()
  tableName: string

  @IsString()
  @IsNotEmpty()
  tenantCode: string
}
