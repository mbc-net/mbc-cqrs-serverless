import { ApiProperty } from '@nestjs/swagger'
import { IsObject, IsOptional, IsString } from 'class-validator'

export class GroupSettingDto {
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
   * code of the setting for the tenant code (required).
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

  /**
   * Group name for the setting (optional).
   * @example '1#2'
   */
  @ApiProperty({
    type: String,
    example: '1#2',
    description: 'The group name or user id for the setting.',
  })
  @IsOptional()
  @IsString()
  groupId: string

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
  settingValue: object
}
