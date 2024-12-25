import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString } from 'class-validator'

import { TenantTypeEnum } from '../enums/tenant.enum'

export class CreateTenantDto {
  /**
   * Value for tenent code create (require).
   */
  @ApiProperty({
    type: String,
    example: 'MBC',
    required: true,
    description: 'tenantCode ',
  })
  @IsString()
  code: string

  @ApiProperty({
    enum: TenantTypeEnum,
    example: TenantTypeEnum.TENANT_SYSTEM,
    required: true,
    description: ' describes the tenant as a System Group or User',
  })
  @IsEnum(TenantTypeEnum)
  type: TenantTypeEnum

  @IsOptional()
  @IsString()
  @ApiProperty({
    type: String,
    example: 'describes the tenant ',
    required: false,
    description: 'description for tenant code',
  })
  description?: string
}
