import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'

export class AddGroupTenantDto {
  /**
   * Value for tenant name create (require).
   */
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