import { serializeToExternal, deserializeToInternal } from '../../../helpers'
import { AirportDataEntity } from '../entity/airport-data.entity'
import { AirportAttributes, LocationAttributes, CodesAttributes, DetailsAttributes } from '../dto/airport-attributes.dto'

/**
 * 空港データの内部形式から外部形式への変換
 * @param internal 内部形式の空港データ
 * @returns 外部形式の空港データ、またはnull
 */
export function airportToExternal(
  internal: AirportDataEntity | null | undefined
): Record<string, any> | null {
  if (!internal?.attributes) return serializeToExternal(internal)
  
  const external = serializeToExternal(internal)
  if (!external) return null

  const { location, codes, details } = internal.attributes
    
  // Location attributes
  if (location) {
    const locationFields: (keyof LocationAttributes)[] = [
      'latitude', 'longitude', 'elevation', 'country',
      'city', 'state', 'county'
    ]
    locationFields.forEach(field => {
      if (typeof location[field] !== 'undefined') {
        external[field] = location[field]
      }
    })
  }
    
  // Code attributes
  if (codes) {
    const codeFields: (keyof CodesAttributes)[] = [
      'icao', 'iata', 'cityCode'
    ]
    codeFields.forEach(field => {
      if (typeof codes[field] !== 'undefined') {
        external[field] = codes[field]
      }
    })
  }
    
  // Detail attributes
  if (details) {
    const detailFields: (keyof DetailsAttributes)[] = [
      'timeZone', 'type', 'url'
    ]
    detailFields.forEach(field => {
      if (typeof details[field] !== 'undefined') {
        external[field] = details[field]
      }
    })
  }
  
  return external
}

/**
 * 空港データの外部形式から内部形式への変換
 * @param data 外部形式の空港データ
 * @returns 内部形式の空港データ、またはnull
 */
export function airportFromExternal(
  data: Record<string, any> | null | undefined
): AirportDataEntity | null {
  if (!data) return null

  const locationFields: (keyof LocationAttributes)[] = [
    'latitude', 'longitude', 'elevation', 'country',
    'city', 'state', 'county'
  ]
  const codeFields: (keyof CodesAttributes)[] = [
    'icao', 'iata', 'cityCode'
  ]
  const detailFields: (keyof DetailsAttributes)[] = [
    'timeZone', 'type', 'url'
  ]

  // Extract grouped fields
  const location = {} as LocationAttributes
  const codes = {} as CodesAttributes
  const details = {} as DetailsAttributes

  // Group fields into their respective categories
  locationFields.forEach(field => {
    if (typeof data[field] !== 'undefined') {
      location[field] = data[field]
    }
  })
  codeFields.forEach(field => {
    if (typeof data[field] !== 'undefined') {
      codes[field] = data[field]
    }
  })
  detailFields.forEach(field => {
    if (typeof data[field] !== 'undefined') {
      details[field] = data[field]
    }
  })

  // Remove grouped fields from rest
  const excludeFields = [...locationFields, ...codeFields, ...detailFields]
  const rest = Object.entries(data).reduce((acc, [key, value]) => {
    if (!excludeFields.includes(key as any)) {
      acc[key] = value
    }
    return acc
  }, {} as Record<string, any>)

  // Construct internal structure
  const internal = {
    ...rest,
    attributes: {
      location,
      codes,
      details
    }
  }

  return deserializeToInternal(internal, AirportDataEntity)
}
