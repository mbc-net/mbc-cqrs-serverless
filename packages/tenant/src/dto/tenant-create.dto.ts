import { ApiProperty } from '@nestjs/swagger'
import { IsObject, IsOptional, IsString } from 'class-validator'

export class TenantCreateDto {
  /**
   * Value for tenant code create (require).
   */
  @ApiProperty({
    type: String,
    example: 'MBC',
    required: true,
    description: 'tenantCode ',
  })
  @IsString()
  code: string

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
  name: string

  @IsOptional()
  @IsObject()
  @ApiProperty({
    type: Object,
    example: 'describes the tenant ',
    required: false,
    description: 'description for tenant code',
  })
  attributes?: object
}
