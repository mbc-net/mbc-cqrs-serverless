import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsObject, IsOptional, IsString } from 'class-validator'

export class MasterBulkItemDto {
  @ApiProperty({
    type: String,
    example: 'Sample Setting',
    required: true,
    description: 'The name of the setting or data.',
  })
  @IsString()
  name: string

  @ApiProperty({
    type: String,
    example: 'SampleCode',
    required: true,
    description: 'The code of the setting or data.',
  })
  @IsString()
  code: string

  @ApiProperty({
    type: String,
    example: 'MBC',
    required: false,
    description: 'The tenant code.',
  })
  @IsString()
  @IsOptional()
  tenantCode?: string

  @ApiProperty({
    type: String,
    example: 'UserListSetting',
    required: false,
    description:
      'The setting code. If present, the item is treated as master data; otherwise as a master setting.',
  })
  @IsString()
  @IsOptional()
  settingCode?: string

  @ApiProperty({
    type: Number,
    example: 0,
    required: false,
    description: 'Sort order (used for master data).',
  })
  @IsNumber()
  @IsOptional()
  seq?: number

  @ApiProperty({
    type: Object,
    example: { region: 'US', plan: 'Premium' },
    required: true,
    description:
      'Attributes object. For settings, this is used as settingValue.',
  })
  @IsObject()
  attributes: object
}
