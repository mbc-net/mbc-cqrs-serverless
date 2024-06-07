import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'

import { DetailKey } from './detail-key.interface'

export class DetailDto implements DetailKey {
  @ApiProperty()
  @IsString()
  pk: string

  @ApiProperty()
  @IsString()
  sk: string
}
