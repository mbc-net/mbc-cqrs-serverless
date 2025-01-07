import { ApiProperty } from '@nestjs/swagger'
import { IsObject, IsString } from 'class-validator'

export class CreateCommonTenantSettingDto {
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
    description: 'The code of the setting.',
  })
  @IsString()
  code: string

  /**
   * Type of the setting for the tenant code (required).
   */

  @ApiProperty({
    type: String,
    example: 'area',
    required: true,
    description: 'The type of the setting.',
  })
  @IsString()
  type: string

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
