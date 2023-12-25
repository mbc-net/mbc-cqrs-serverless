import { Transform } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

import { PaginateDto } from './paginate.dto'

export class SearchDto extends PaginateDto {
  /**
   * search keyword
   */
  @IsOptional()
  keyword?: string

  @IsOptional()
  id?: string
  @IsOptional()
  pk?: string
  @IsOptional()
  sk?: string

  @IsOptional()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  orderBys?: string[]
}
