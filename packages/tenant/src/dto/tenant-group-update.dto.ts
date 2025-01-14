import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsString } from 'class-validator'

export class TenantGroupUpdateDto {
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
  @IsArray()
  settingGroups: string[]

  @IsString()
  @ApiProperty({
    type: String,
    example: 'describes the tenant ',
    required: true,
    description: 'description for tenant code',
  })
  role: string
}
