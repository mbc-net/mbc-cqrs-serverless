import { DataEntity } from '../../interfaces/data.entity'
import { AirportAttributes } from '../dto/airport-attributes.dto'

export class AirportDataEntity extends DataEntity {
  attributes: AirportAttributes

  constructor(partial: Partial<AirportDataEntity>) {
    const icaoCode = partial.attributes?.codes?.icao || ''
    const defaults = {
      // Required fields from DataEntity
      type: 'AIRPORT',
      pk: 'AIRPORT',
      sk: icaoCode,
      code: icaoCode,
      name: partial.name || '',
      version: partial.version || 1,
      tenantCode: partial.tenantCode || process.env.TENANT_CODE || 'default',
      id: `AIRPORT#${icaoCode}`,
      
      // Optional fields
      isDeleted: partial.isDeleted || false,
      seq: partial.seq,
      ttl: partial.ttl,
      
      // Audit fields
      createdAt: partial.createdAt || new Date(),
      updatedAt: partial.updatedAt || new Date(),
      createdBy: partial.createdBy || '',
      updatedBy: partial.updatedBy || '',
      createdIp: partial.createdIp || '',
      updatedIp: partial.updatedIp || ''
    }
    
    super({ ...defaults, ...partial })
  }
}
