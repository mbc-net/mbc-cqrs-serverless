import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

import { DataEntity } from './data.entity'

/**
 * Paginated list response for data queries.
 * Used when listing items by partition key with cursor-based pagination.
 *
 * @example
 * // API response
 * {
 *   "total": 100,
 *   "lastSk": "ITEM#50",
 *   "items": [...]
 * }
 *
 * // Next page request uses lastSk as cursor
 * GET /items?pk=ORDER&startSk=ITEM#50
 */
export class DataListEntity {
  @ApiPropertyOptional()
  total?: number
  @ApiPropertyOptional()
  lastSk?: string
  @ApiProperty({
    type: [DataEntity],
  })
  items: DataEntity[]

  constructor(data: Partial<DataListEntity>) {
    Object.assign(this, data)
  }
}
