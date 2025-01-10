import { DataEntity } from '../../interfaces/data.entity'
import { AirportAttributes } from '../dto/airport-attributes.dto'

export class AirportDataEntity extends DataEntity {
  attributes: AirportAttributes

  constructor(partial: Partial<AirportDataEntity>) {
    const defaults = {
      type: 'AIRPORT',
      pk: 'AIRPORT',
      sk: partial.attributes?.codes?.icao || '',
      code: partial.attributes?.codes?.icao || '',
      name: partial.name || '',
      version: partial.version || 1,
      tenantCode: partial.tenantCode || '',
      id: `AIRPORT#${partial.attributes?.codes?.icao || ''}`
    }
    
    super({ ...defaults, ...partial })
  }
}
