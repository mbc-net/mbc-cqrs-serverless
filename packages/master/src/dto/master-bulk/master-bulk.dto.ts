import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  ValidateNested,
} from 'class-validator'

import { MasterBulkItemDto } from './master-bulk-item.dto'

export class MasterBulkDto {
  @ApiProperty({
    type: [MasterBulkItemDto],
    description: 'Array of items to upsert',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MasterBulkItemDto)
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  items: MasterBulkItemDto[]
}
