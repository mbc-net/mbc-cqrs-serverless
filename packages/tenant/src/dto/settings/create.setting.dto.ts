import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator'

import { SettingTypeEnum } from '../../enums/setting.enum'

export class CreateSettingByTenantDto {
  /**
   * Name of the setting for the tenant code (required).
   */
  @ApiProperty({
    type: String,
    example: ' User List Setting',
    required: true,
    description: 'The name of the setting.',
  })
  @IsString()
  name: string

  /**
   * Name of the setting for the tenant code (required).
   */

  @ApiProperty({
    type: String,
    example: 'UserListSetting',
    required: true,
    description: 'The name of the setting.',
  })
  @IsString()
  code: string

  /**
   * Tenant code associated with the setting (required).
   */
  @ApiProperty({
    type: String,
    example: 'MBC',
    required: true,
    description: 'The tenant code.',
  })
  @IsString()
  tenantCode: string

  @ApiProperty({
    enum: SettingTypeEnum,
    example: SettingTypeEnum.TENANT_COMMON,
    required: true,
    description: 'The type of the setting.',
  })
  @IsEnum(SettingTypeEnum)
  type: SettingTypeEnum

  /**
   * Group name for the setting (optional).
   * @example '1#2'
   */
  @ApiProperty({
    type: String,
    example: '1#2',
    description: 'The group name for the setting.',
  })
  @IsOptional()
  @IsString()
  group?: string

  /**
   * Additional attributes for the tenant (required).
   */
  @ApiProperty({
    type: Object,
    example: { region: 'US', plan: 'Premium' },
    required: true,
    description: 'Additional attributes describing the tenant.',
  })
  @IsObject()
  attributes: object
}
