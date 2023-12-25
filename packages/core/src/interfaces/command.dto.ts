import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator'

import { CommandInputModel } from './command-input-model.interface'

export class CommandDto implements CommandInputModel {
  @IsString()
  pk: string

  @IsString()
  sk: string

  @IsString()
  id: string

  @IsString()
  code: string

  @IsString()
  name: string

  @IsNumber()
  version: number

  @IsOptional()
  tenantCode: string

  @IsString()
  type: string

  @IsOptional()
  @IsNumber()
  seq?: number

  @IsOptional()
  @IsNumber()
  ttl?: number

  @IsOptional()
  @IsBoolean()
  isDeleted?: boolean

  attributes?: Record<string, any>
}
