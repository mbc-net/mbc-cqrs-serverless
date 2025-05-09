import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'

export class GetSettingDto {
  /**
   * code of the setting for the tenant code (required).
   */
  @ApiProperty({
    type: String,
    example: ' User List Setting',
    required: true,
    description: 'The name of the setting.',
  })
  @IsString()
  code: string
}
