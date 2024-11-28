import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator'

import { RotateByEnum } from '../enums/rotate-by.enum'

export class SequenceParamsDto {
  //code1#code2#code3#code4#code5

  @IsString()
  code1: string

  @IsString()
  @IsOptional()
  code2?: string

  @IsOptional()
  @IsString()
  code3?: string

  @IsOptional()
  @IsString()
  code4?: string

  @IsOptional()
  @IsString()
  code5?: string

  constructor(partial: Partial<SequenceParamsDto>) {
    Object.assign(this, partial)
  }
}

export class GenSequenceDto {
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
  @ApiProperty({ description: 'Code of the tenant (organization).' })
  tenantCode: string

  /**
   * Type code for specific sequence classification.
   */
  @IsString()
  @ApiProperty({
    required: true,
    description: 'Type code for specific classification.',
  })
  typeCode: string
}

export class GenerateFormattedSequenceDto {
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
  tenantCode: string

  @IsString()
  typeCode: string

  /**
   * Type code for specific sequence classification.
   */
  @IsObject()
  @ApiProperty({
    type: SequenceParamsDto,
    description:
      'Parameters for generating the sequence. code1, code2,code3, code4, code5',
  })
  params: SequenceParamsDto
}
