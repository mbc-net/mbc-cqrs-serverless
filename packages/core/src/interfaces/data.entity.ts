import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

import { DataModel } from './data-model.interface'
import { DetailKey } from './detail-key.interface'

export class DataEntity implements DataModel {
  @ApiPropertyOptional()
  cpk?: string
  @ApiPropertyOptional()
  csk?: string
  @ApiPropertyOptional()
  source?: string
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

  attributes?: Record<string, any>

  constructor(data: Partial<DataEntity>) {
    Object.assign(this, data)
  }

  get key(): DetailKey {
    return {
      pk: this.pk,
      sk: this.sk,
    }
  }
}
