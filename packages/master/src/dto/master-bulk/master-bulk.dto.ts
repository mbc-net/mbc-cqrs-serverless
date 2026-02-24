import { Type } from 'class-transformer'
import { ArrayNotEmpty, IsArray, ValidateNested } from 'class-validator'

import { MasterBulkItemDto } from './master-bulk-item.dto'

export class MasterBulkDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MasterBulkItemDto)
  @ArrayNotEmpty()
  items: MasterBulkItemDto[]
}
