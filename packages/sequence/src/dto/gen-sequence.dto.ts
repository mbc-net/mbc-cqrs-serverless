import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString } from 'class-validator'

import { RotateByEnum } from '../enums/rotate-by.enum'

export class GenSequenceDto {
  @IsString()
  @IsOptional()
  date?: Date

  @ApiProperty({ enum: RotateByEnum, example: RotateByEnum.FISCAL_YEARLY })
  @IsOptional()
  @IsEnum(RotateByEnum)
  rotateBy?: RotateByEnum

  @IsString()
  tenantCode: string

  @IsString()
  typeCode: string
}
