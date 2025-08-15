import { IsEnum, IsNotEmpty, IsString } from 'class-validator'

import { ProcessingMode } from '../enum'

export class CreateCsvImportDto {
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
