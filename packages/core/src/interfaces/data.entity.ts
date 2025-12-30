import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

import { DataModel } from './data-model.interface'
import { DetailKey } from './detail-key.interface'

/**
 * Base entity class for all data stored in DynamoDB.
 * Implements the DataModel interface with common fields for CQRS operations.
 *
 * @example
 * ```typescript
 * const entity = new DataEntity({
 *   pk: 'TENANT001#ORDER',
 *   sk: 'ORDER#123',
 *   id: '123',
 *   code: 'ORD-001',
 *   name: 'Sample Order',
 *   version: 1,
 *   tenantCode: 'TENANT001',
 *   type: 'ORDER',
 * });
 * ```
 */
export class DataEntity implements DataModel {
  @ApiPropertyOptional()
  cpk?: string
  @ApiPropertyOptional()
  csk?: string
  @ApiPropertyOptional()
  source?: string
  @ApiPropertyOptional()
  requestId?: string
  @ApiPropertyOptional()
  createdAt?: Date
  @ApiPropertyOptional()
  updatedAt?: Date
  @ApiPropertyOptional()
  createdBy?: string
  @ApiPropertyOptional()
  updatedBy?: string
  @ApiPropertyOptional()
  createdIp?: string
  @ApiPropertyOptional()
  updatedIp?: string
  /** Partition key for DynamoDB. Format: {tenantCode}#{entityType} */
  @ApiProperty()
  pk: string

  /** Sort key for DynamoDB. Format: {entityType}#{entityId} */
  @ApiProperty()
  sk: string

  /** Unique identifier for the entity */
  @ApiProperty()
  id: string

  /** Business code for the entity */
  @ApiProperty()
  code: string

  /** Display name of the entity */
  @ApiProperty()
  name: string

  /** Version number for optimistic locking */
  @ApiProperty()
  version: number

  /** Tenant code for multi-tenant isolation */
  @ApiProperty()
  tenantCode: string

  /** Entity type identifier */
  @ApiProperty()
  type: string
  @ApiPropertyOptional()
  seq?: number
  @ApiPropertyOptional()
  ttl?: number
  @ApiPropertyOptional()
  isDeleted?: boolean

  attributes?: Record<string, any>

  constructor(data: Partial<DataEntity>) {
    Object.assign(this, data)
  }

  get key(): DetailKey {
    return {
      pk: this.pk,
      sk: this.sk,
    }
  }
}
