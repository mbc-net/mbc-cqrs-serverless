import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator'

import { RotateByEnum } from '../enums/rotate-by.enum'
import { SequenceParamsDto } from './sequence-param.dto'

export class GenerateFormattedSequenceWithProvidedSettingDto {
  /**
   * Date for sequence generation (optional).
   */
  @IsOptional()
  @Type(() => Date)
  @ApiProperty({
    type: Date,
    required: false,
    description: 'Date for sequence generation.',
  })
  date?: Date

  /**
   * Rotation criteria for the sequence (e.g., yearly, fiscal-yearly).
   */
  @ApiProperty({ enum: RotateByEnum, example: RotateByEnum.FISCAL_YEARLY })
  @IsOptional()
  @IsEnum(RotateByEnum)
  rotateBy?: RotateByEnum

  /**
   * Tenant code for identifying the organization.
   */
  @IsString()
  @ApiProperty()
  tenantCode: string

  /**
   * Type code for specific sequence classification.
   */
  @IsString()
  @ApiProperty()
  typeCode: string

  /**
   * Type code for specific sequence classification.
   */
  @IsOptional()
  @IsObject()
  @ApiProperty({
    type: SequenceParamsDto,
    description:
      'Parameters for generating the sequence. code1, code2, code3, code4, code5',
  })
  params?: SequenceParamsDto

  /**
   * Optional prefix to add before formatted sequence.
   */
  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    description: 'Optional prefix to prepend to the formatted sequence.',
  })
  prefix?: string

  /**
   * Optional postfix to add after formatted sequence.
   */
  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    description: 'Optional postfix to append to the formatted sequence.',
  })
  postfix?: string

  /**
   * Format string defining the structure of the generated sequence.
   * Example: 'YYMM-SEQ' where parts like YY, MM, and SEQ are replaced accordingly.
   */
  @IsString()
  @ApiProperty({
    description:
      'Format string defining the structure of the generated sequence. Example: "YYMM-SEQ".',
  })
  format: string

  /**
   * Optional registration date to influence fiscal year calculation or other logic.
   * Accepts an ISO 8601 date string.
   */
  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    description:
      'Optional registration date to influence fiscal year calculation. Format: ISO 8601.',
  })
  registerDate?: string

  /**
   * Optional starting month of the fiscal year. Defaults to 4 (April) if not provided.
   * Used when rotateBy is set to FISCAL_YEARLY.
   */
  @IsOptional()
  @IsNumber()
  @ApiProperty({
    required: false,
    description:
      'Starting month of the fiscal year (1–12). Defaults to 4 (April) if not provided.',
  })
  startMonth?: number
}
