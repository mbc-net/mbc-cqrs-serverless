import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsEnum, IsOptional, IsString } from 'class-validator'

import { RotateByEnum } from '../enums/rotate-by.enum'

export class GenerateSequenceDto {
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
