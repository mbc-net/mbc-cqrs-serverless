import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator'

import { CommandInputModel } from './command-input-model.interface'

export class CommandDto implements CommandInputModel {
  @ApiProperty()
  @IsString()
  pk: string

  @ApiProperty()
  @IsString()
  sk: string

  @ApiProperty()
  @IsString()
  id: string

  @ApiProperty()
  @IsString()
  code: string

  @ApiProperty()
  @IsString()
  name: string

  @ApiProperty()
  @IsNumber()
  version: number

  @ApiProperty()
  @IsOptional()
  tenantCode: string

  @ApiProperty()
  @IsString()
  type: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  seq?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  ttl?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean

  @ApiPropertyOptional({ type: 'object' })
  attributes?: Record<string, any>
}
