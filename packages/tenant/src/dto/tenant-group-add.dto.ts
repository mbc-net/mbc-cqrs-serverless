import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'

export class TenantGroupAddDto {
  /**
   * Value for tenant name create (required).
   */
  @ApiProperty({
    type: String,
    example: 'MBC',
    required: true,
    description: 'tenantCode ',
  })
  @IsString()
  tenantCode: string

  @ApiProperty({
    type: String,
    example: 'MBC',
    required: true,
    description: 'tenantName ',
  })
  @IsString()
  groupId: string

  @IsString()
  @ApiProperty({
    type: String,
    example: 'describes the tenant ',
    required: true,
    description: 'description for tenant code',
  })
  role: string
}
