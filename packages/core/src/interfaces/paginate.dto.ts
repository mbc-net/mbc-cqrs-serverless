import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsInt, Min } from 'class-validator'

export class PaginateDto {
  /**
   * Current page number
   * @example 10
   */
  @ApiPropertyOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1

  /**
   * Items number per page
   * @example 100
   */
  @ApiPropertyOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  pageSize?: number = 10

  constructor(partial: Partial<PaginateDto>) {
    Object.assign(this, partial)
  }
}
