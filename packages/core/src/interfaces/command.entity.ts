import { ApiProperty } from '@nestjs/swagger'

import { CommandModel } from './command-model.interface'
import { DetailKey } from './detail-key.interface'

export class CommandEntity implements CommandModel {
  @ApiProperty()
  source?: string
  @ApiProperty()
  isDeleted?: boolean
  @ApiProperty()
  status?: string
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
  attributes?: any

  get key(): DetailKey {
    return {
      pk: this.pk,
      sk: this.sk,
    }
  }
}
