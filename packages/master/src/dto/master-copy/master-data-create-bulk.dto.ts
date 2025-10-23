import { Type } from 'class-transformer'
import { ArrayNotEmpty, IsArray, ValidateNested } from 'class-validator'

import { MasterDataCreateDto } from './master-data-create.dto'

export class MasterDataCreateBulkDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MasterDataCreateDto)
  @ArrayNotEmpty()
  items: MasterDataCreateDto[]
}
