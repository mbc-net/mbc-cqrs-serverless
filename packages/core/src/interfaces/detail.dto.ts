import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'

import { DetailKey } from './detail-key.interface'

/**
 * DTO for retrieving a single item by its DynamoDB key.
 * Used in GET, PUT, DELETE operations that target a specific item.
 *
 * @example
 * // GET /items/:pk/:sk
 * // Request: { pk: "ORDER#123", sk: "ITEM#A" }
 */
export class DetailDto implements DetailKey {
  @ApiProperty()
  @IsString()
  pk: string

  @ApiProperty()
  @IsString()
  sk: string
}
