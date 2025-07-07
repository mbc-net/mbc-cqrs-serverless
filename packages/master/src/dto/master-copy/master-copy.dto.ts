import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'

export enum CopyType {
  SETTING_ONLY = 'SETTING_ONLY',
  DATA_ONLY = 'DATA_ONLY',
  BOTH = 'BOTH',
}

export enum DataCopyMode {
  ALL = 'ALL',
  PARTIAL = 'PARTIAL',
}

export class DataCopyOptionDto {
  @ApiProperty({
    enum: DataCopyMode,
    description: 'Whether to copy all master_data or only specific ones',
  })
  @IsEnum(DataCopyMode)
  mode: DataCopyMode

  @ApiPropertyOptional({
    description:
      'Required only if mode is PARTIAL. List of master_data IDs to copy.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  id?: string[]
}

export class MasterCopyDto {
  @ApiProperty({
    description: 'The ID of the master_setting to copy from',
  })
  @IsString()
  @IsNotEmpty()
  masterSettingId: string

  @ApiProperty({
    description: 'Target tenants as an array of tenant codes',
    example: ['tenant_b', 'tenant_c'],
  })
  @IsNotEmpty()
  targetTenants: string[]

  @ApiProperty({
    enum: CopyType,
    description: 'What to copy: only setting, only data, or both',
  })
  @IsEnum(CopyType)
  copyType: CopyType

  @ApiPropertyOptional({
    type: DataCopyOptionDto,
    description:
      'Options for data copy (required when copyType is DATA_ONLY or BOTH)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DataCopyOptionDto)
  dataCopyOption?: DataCopyOptionDto
}
