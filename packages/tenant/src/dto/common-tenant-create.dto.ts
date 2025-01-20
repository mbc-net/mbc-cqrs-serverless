import { ApiProperty } from '@nestjs/swagger'
import { IsObject, IsOptional, IsString } from 'class-validator'

export class CommonTenantCreateDto {
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

  /**
   * attributes for tenant code
   */

  @IsOptional()
  @IsObject()
  @ApiProperty({
    type: Object,
    required: false,
    description: 'attributes for tenant code',
  })
  attributes?: object
}
