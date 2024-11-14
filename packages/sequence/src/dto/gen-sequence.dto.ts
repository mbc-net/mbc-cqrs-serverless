import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator'

import { RotateByEnum } from '../enums/rotate-by.enum'

export class SequenceParamsDto {
  //code1#code2#code3#code4#code5

  @IsString()
  code1: string

  @IsString()
  code2: string

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
  @IsString()
  @IsOptional()
  date?: Date

  @ApiProperty({ enum: RotateByEnum, example: RotateByEnum.FISCAL_YEARLY })
  @IsOptional()
  @IsEnum(RotateByEnum)
  rotateBy?: RotateByEnum

  @IsString()
  tenantCode: string

  @IsObject()
  params: SequenceParamsDto

  @IsString()
  @IsOptional()
  format?: string

  @IsString()
  @IsOptional()
  registerDate?: Date
}
