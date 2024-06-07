import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

import { PaginateDto } from './paginate.dto'

export class SearchDto extends PaginateDto {
  /**
   * search keyword
   */
  @ApiPropertyOptional()
  @IsOptional()
  keyword?: string

  @ApiPropertyOptional()
  @IsOptional()
  id?: string

  @ApiPropertyOptional()
  @IsOptional()
  @ApiPropertyOptional()
  pk?: string

  @ApiPropertyOptional()
  @IsOptional()
  sk?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  orderBys?: string[]
}
