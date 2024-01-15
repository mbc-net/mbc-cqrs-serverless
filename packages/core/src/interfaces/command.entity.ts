import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

import { CommandModel } from './command-model.interface'
import { DetailKey } from './detail-key.interface'

export class CommandEntity implements CommandModel {
  @ApiPropertyOptional()
  source?: string
  @ApiPropertyOptional()
  isDeleted?: boolean
  @ApiPropertyOptional()
  status?: string
  @ApiPropertyOptional()
  requestId?: string
  @ApiPropertyOptional()
  createdAt?: Date
  @ApiPropertyOptional()
  updatedAt?: Date
  @ApiPropertyOptional()
  createdBy?: string
  @ApiPropertyOptional()
  updatedBy?: string
  @ApiPropertyOptional()
  createdIp?: string
  @ApiPropertyOptional()
  updatedIp?: string
  @ApiProperty()
  pk: string
  @ApiProperty()
  sk: string
  @ApiProperty()
  id: string
  @ApiProperty()
  code: string
  @ApiProperty()
  name: string
  @ApiProperty()
  version: number
  @ApiProperty()
  tenantCode: string
  @ApiProperty()
  type: string
  @ApiPropertyOptional()
  seq?: number
  @ApiPropertyOptional()
  ttl?: number

  attributes?: any

  get key(): DetailKey {
    return {
      pk: this.pk,
      sk: this.sk,
    }
  }
}
