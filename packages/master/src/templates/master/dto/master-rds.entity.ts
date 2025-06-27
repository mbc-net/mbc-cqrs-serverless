import { ApiProperty } from '@nestjs/swagger'
import { Master } from '@prisma/client'

export class MasterRdsEntity {
  @ApiProperty()
  id: string

  @ApiProperty()
  cpk: string

  @ApiProperty()
  csk: string

  @ApiProperty()
  pk: string

  @ApiProperty()
  sk: string

  @ApiProperty()
  masterType: string

  @ApiProperty()
  masterTypeCode: string

  @ApiProperty()
  masterCode: string

  @ApiProperty()
  tenantCode: string

  @ApiProperty()
  seq: number

  @ApiProperty()
  code: string

  @ApiProperty()
  name: string

  @ApiProperty()
  version: number

  @ApiProperty()
  isDeleted: boolean

  @ApiProperty()
  createdBy: string

  @ApiProperty()
  createdIp: string

  @ApiProperty()
  createdAt: Date

  @ApiProperty()
  updatedBy: string

  @ApiProperty()
  updatedIp: string

  @ApiProperty()
  updatedAt: Date

  @ApiProperty({ required: false })
  syncFrom?: string

  @ApiProperty({ required: false })
  syncDate?: Date

  @ApiProperty({ type: 'object', required: false })
  attributes?: Record<string, any>

  constructor(data: Partial<Master>) {
    Object.assign(this, data)
  }
}
