import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  ValidateNested,
} from 'class-validator'

import { MasterDataCreateDto } from './master-data-create.dto'

export class MasterDataCreateBulkDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MasterDataCreateDto)
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  items: MasterDataCreateDto[]
}
