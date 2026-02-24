import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  ValidateNested,
} from 'class-validator'

import { MasterBulkItemDto } from './master-bulk-item.dto'

export class MasterBulkDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MasterBulkItemDto)
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  items: MasterBulkItemDto[]
}
