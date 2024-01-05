import { ApiProperty } from '@nestjs/swagger'

import { DataModel } from './data-model.interface'
import { DetailKey } from './detail-key.interface'

export class DataEntity implements DataModel {
  @ApiProperty()
  cpk?: string
  @ApiProperty()
  csk?: string
  @ApiProperty()
  source?: string
  @ApiProperty()
  requestId?: string
  @ApiProperty()
  createdAt?: Date
  @ApiProperty()
  updatedAt?: Date
  @ApiProperty()
  createdBy?: string
  @ApiProperty()
  updatedBy?: string
  @ApiProperty()
  createdIp?: string
  @ApiProperty()
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
  @ApiProperty()
  seq?: number
  @ApiProperty()
  ttl?: number
  @ApiProperty()
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
