import { parse } from 'csv-parse'
import { createReadStream } from 'fs'
import { resolve } from 'path'
import { DynamoDB } from '@aws-sdk/client-dynamodb'
import { AirportDataEntity } from '../entity/airport-data.entity'

// DynamoDB クライアントの初期化
const dynamodb = new DynamoDB({
  region: process.env.AWS_REGION || 'ap-northeast-1'
})

interface CsvRow {
  code: string
  icao: string
  name: string
  latitude: string
  longitude: string
  elevation: string
  url: string
  time_zone: string
  city_code: string
  country: string
  city: string
  state: string
  county: string
  type: string
}

interface ValidationError {
  row: number
  errors: string[]
}

/**
 * CSVデータを検証する
 * @param row CSVの行データ
 * @param rowIndex 行番号
 * @returns エラーメッセージの配列
 */
function validateRow(row: CsvRow, rowIndex: number): string[] {
  const errors: string[] = []

  // Required fields
  if (!row.icao) {
    errors.push(`ICAO code is required (row ${rowIndex})`)
  }
  if (!row.name) {
    errors.push(`Name is required (row ${rowIndex})`)
  }
  if (!row.latitude || isNaN(Number(row.latitude))) {
    errors.push(`Invalid latitude (row ${rowIndex})`)
  }
  if (!row.longitude || isNaN(Number(row.longitude))) {
    errors.push(`Invalid longitude (row ${rowIndex})`)
  }
  if (!row.country) {
    errors.push(`Country is required (row ${rowIndex})`)
  }
  if (!row.type) {
    errors.push(`Type is required (row ${rowIndex})`)
  }

  // Optional number fields
  if (row.elevation && isNaN(Number(row.elevation))) {
    errors.push(`Invalid elevation (row ${rowIndex})`)
  }

  return errors
}

/**
 * CSVの行データをAirportDataEntityに変換する
 * @param row CSVの行データ
 * @returns AirportDataEntity
 */
function transformRow(row: CsvRow): AirportDataEntity {
  return new AirportDataEntity({
    name: row.name,
    attributes: {
      location: {
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        elevation: row.elevation ? Number(row.elevation) : undefined,
        country: row.country,
        city: row.city || undefined,
        state: row.state || undefined,
        county: row.county || undefined
      },
      codes: {
        icao: row.icao,
        iata: row.code || undefined,
        cityCode: row.city_code || undefined
      },
      details: {
        timeZone: row.time_zone || undefined,
        type: row.type,
        url: row.url || undefined
      }
    }
  })
}

/**
 * 空港データをCSVからインポートする
 */
async function importAirports(): Promise<void> {
  const csvPath = resolve(__dirname, '../data/airports.csv')
  const parser = parse({
    columns: true,
    skip_empty_lines: true
  })

  const validationErrors: ValidationError[] = []
  const airports: AirportDataEntity[] = []
  const seenIcaoCodes = new Set<string>()
  let rowIndex = 1

  // Parse CSV and validate data
  for await (const row of createReadStream(csvPath).pipe(parser)) {
    const errors = validateRow(row as CsvRow, rowIndex)
    
    if (errors.length > 0) {
      validationErrors.push({ row: rowIndex, errors })
    } else {
      const icaoCode = (row as CsvRow).icao
      
      // Check for duplicate ICAO codes
      if (seenIcaoCodes.has(icaoCode)) {
        validationErrors.push({
          row: rowIndex,
          errors: [`Duplicate ICAO code: ${icaoCode}`]
        })
      } else {
        seenIcaoCodes.add(icaoCode)
        airports.push(transformRow(row as CsvRow))
      }
    }
    
    rowIndex++
  }

  // Report validation errors
  if (validationErrors.length > 0) {
    console.error('Validation errors found:')
    validationErrors.forEach(({ row, errors }) => {
      errors.forEach(error => console.error(`Row ${row}: ${error}`))
    })
    process.exit(1)
  }

  // Batch write to DynamoDB
  const tableName = process.env.DYNAMODB_TABLE || 'mbc-cqrs-serverless-data'
  const batchSize = 25 // DynamoDB batch write limit
  
  for (let i = 0; i < airports.length; i += batchSize) {
    const batch = airports.slice(i, i + batchSize)
    const requests = batch.map(airport => ({
      PutRequest: {
        Item: {
          pk: { S: airport.pk },
          sk: { S: airport.sk },
          id: { S: airport.id },
          code: { S: airport.code },
          name: { S: airport.name },
          type: { S: airport.type },
          version: { N: airport.version.toString() },
          tenantCode: { S: airport.tenantCode },
          attributes: { S: JSON.stringify(airport.attributes) }
        }
      }
    }))

    try {
      await dynamodb.batchWriteItem({
        RequestItems: {
          [tableName]: requests
        }
      })
      console.log(`Imported airports ${i + 1} to ${i + batch.length}`)
    } catch (error) {
      console.error(`Failed to import batch starting at ${i + 1}:`, error)
      process.exit(1)
    }
  }

  console.log(`Successfully imported ${airports.length} airports to DynamoDB`)
}

// Run the import with error handling
importAirports().catch(error => {
  console.error('Import failed:', error)
  process.exit(1)
})
