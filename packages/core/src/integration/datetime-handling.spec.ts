/**
 * DateTime Handling Tests
 *
 * This file tests date and time handling:
 * - ISO 8601 format
 * - Timezone conversion
 * - Epoch time boundaries
 * - Invalid date handling
 * - Date transformation with class-transformer
 *
 * These tests verify datetime handling contracts to detect breaking changes.
 */
import 'reflect-metadata'

import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import {
  instanceToPlain,
  plainToInstance,
  Transform,
  Type,
} from 'class-transformer'
import { IsDate, IsISO8601, validate } from 'class-validator'

describe('DateTime Handling Tests', () => {
  // ============================================================================
  // ISO 8601 Format Handling
  // ============================================================================
  describe('ISO 8601 format handling', () => {
    describe('Parsing ISO 8601 strings', () => {
      it('should parse full ISO 8601 string with timezone', () => {
        const isoString = '2024-01-15T10:30:00Z'
        const date = new Date(isoString)

        expect(date.toISOString()).toBe('2024-01-15T10:30:00.000Z')
        expect(date.getUTCFullYear()).toBe(2024)
        expect(date.getUTCMonth()).toBe(0) // January is 0
        expect(date.getUTCDate()).toBe(15)
        expect(date.getUTCHours()).toBe(10)
        expect(date.getUTCMinutes()).toBe(30)
      })

      it('should parse ISO 8601 with milliseconds', () => {
        const isoString = '2024-01-15T10:30:00.123Z'
        const date = new Date(isoString)

        expect(date.getUTCMilliseconds()).toBe(123)
        expect(date.toISOString()).toBe('2024-01-15T10:30:00.123Z')
      })

      it('should parse ISO 8601 with positive timezone offset', () => {
        const isoString = '2024-01-15T19:30:00+09:00'
        const date = new Date(isoString)

        // +09:00 means the time is 9 hours ahead of UTC
        expect(date.getUTCHours()).toBe(10) // 19 - 9 = 10 UTC
      })

      it('should parse ISO 8601 with negative timezone offset', () => {
        const isoString = '2024-01-15T05:30:00-05:00'
        const date = new Date(isoString)

        // -05:00 means the time is 5 hours behind UTC
        expect(date.getUTCHours()).toBe(10) // 5 + 5 = 10 UTC
      })

      it('should parse date-only ISO 8601', () => {
        const dateString = '2024-01-15'
        const date = new Date(dateString)

        expect(date.getUTCFullYear()).toBe(2024)
        expect(date.getUTCMonth()).toBe(0)
        expect(date.getUTCDate()).toBe(15)
      })
    })

    describe('Generating ISO 8601 strings', () => {
      it('should generate standard ISO 8601 string', () => {
        const date = new Date(Date.UTC(2024, 0, 15, 10, 30, 0))
        const isoString = date.toISOString()

        expect(isoString).toBe('2024-01-15T10:30:00.000Z')
        expect(isoString).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        )
      })

      it('should preserve milliseconds in ISO string', () => {
        const date = new Date(Date.UTC(2024, 0, 15, 10, 30, 0, 123))
        expect(date.toISOString()).toBe('2024-01-15T10:30:00.123Z')
      })
    })
  })

  // ============================================================================
  // Timezone Conversion
  // ============================================================================
  describe('Timezone conversion', () => {
    describe('UTC operations', () => {
      it('should create date in UTC', () => {
        const date = new Date(Date.UTC(2024, 6, 15, 12, 0, 0))

        expect(date.getUTCFullYear()).toBe(2024)
        expect(date.getUTCMonth()).toBe(6) // July
        expect(date.getUTCDate()).toBe(15)
        expect(date.getUTCHours()).toBe(12)
      })

      it('should convert UTC to local time', () => {
        const utcDate = new Date(Date.UTC(2024, 0, 15, 0, 0, 0))
        const utcTimestamp = utcDate.getTime()

        // Local getters account for timezone
        const localHours = utcDate.getHours()
        const utcHours = utcDate.getUTCHours()

        // The difference depends on local timezone
        const offsetMinutes = utcDate.getTimezoneOffset()
        const expectedLocalHours = (24 + utcHours - offsetMinutes / 60) % 24

        expect(localHours).toBe(Math.floor(expectedLocalHours))
      })

      it('should maintain UTC consistency across operations', () => {
        const date1 = new Date('2024-01-15T10:30:00Z')
        const date2 = new Date(Date.UTC(2024, 0, 15, 10, 30, 0))

        expect(date1.getTime()).toBe(date2.getTime())
        expect(date1.toISOString()).toBe(date2.toISOString())
      })
    })

    describe('Timezone offset handling', () => {
      it('should get timezone offset in minutes', () => {
        const date = new Date()
        const offset = date.getTimezoneOffset()

        // Offset is in minutes, positive for west of UTC
        expect(typeof offset).toBe('number')
        expect(offset).toBeGreaterThanOrEqual(-720) // UTC+12
        expect(offset).toBeLessThanOrEqual(720) // UTC-12
      })

      it('should correctly handle date comparison across timezones', () => {
        // Same moment in time, different representations
        const utc = new Date('2024-01-15T00:00:00Z')
        const tokyo = new Date('2024-01-15T09:00:00+09:00')

        expect(utc.getTime()).toBe(tokyo.getTime())
      })
    })
  })

  // ============================================================================
  // Epoch Time Boundaries
  // ============================================================================
  describe('Epoch time boundaries', () => {
    describe('Unix epoch (1970)', () => {
      it('should handle Unix epoch start', () => {
        const epoch = new Date(0)

        expect(epoch.toISOString()).toBe('1970-01-01T00:00:00.000Z')
        expect(epoch.getTime()).toBe(0)
      })

      it('should handle dates before epoch', () => {
        const beforeEpoch = new Date('1969-12-31T23:59:59Z')

        expect(beforeEpoch.getTime()).toBeLessThan(0)
        expect(beforeEpoch.getTime()).toBe(-1000)
      })

      it('should handle dates well before epoch', () => {
        const earlyDate = new Date('1900-01-01T00:00:00Z')

        expect(earlyDate.getTime()).toBeLessThan(0)
        expect(earlyDate.getUTCFullYear()).toBe(1900)
      })
    })

    describe('Year 2038 problem', () => {
      it('should handle dates beyond 2038', () => {
        const y2038 = new Date('2038-01-19T03:14:07Z')
        const afterY2038 = new Date('2038-01-19T03:14:08Z')

        // JavaScript uses 64-bit timestamps, so no Y2038 issue
        expect(afterY2038.getTime()).toBeGreaterThan(y2038.getTime())
        expect(afterY2038.toISOString()).toBe('2038-01-19T03:14:08.000Z')
      })

      it('should handle year 2100', () => {
        const y2100 = new Date('2100-12-31T23:59:59Z')

        expect(y2100.getUTCFullYear()).toBe(2100)
        expect(y2100.toISOString()).toBe('2100-12-31T23:59:59.000Z')
      })
    })

    describe('Maximum and minimum dates', () => {
      it('should handle maximum JavaScript date', () => {
        const maxDate = new Date(8640000000000000)

        expect(maxDate.getTime()).toBe(8640000000000000)
        expect(isNaN(maxDate.getTime())).toBe(false)
      })

      it('should handle minimum JavaScript date', () => {
        const minDate = new Date(-8640000000000000)

        expect(minDate.getTime()).toBe(-8640000000000000)
        expect(isNaN(minDate.getTime())).toBe(false)
      })

      it('should return Invalid Date beyond limits', () => {
        const beyondMax = new Date(8640000000000001)
        const beyondMin = new Date(-8640000000000001)

        expect(isNaN(beyondMax.getTime())).toBe(true)
        expect(isNaN(beyondMin.getTime())).toBe(true)
      })
    })
  })

  // ============================================================================
  // Invalid Date Handling
  // ============================================================================
  describe('Invalid date handling', () => {
    describe('Invalid Date creation', () => {
      it('should create Invalid Date from invalid string', () => {
        const invalidDate = new Date('not-a-date')

        expect(isNaN(invalidDate.getTime())).toBe(true)
        expect(invalidDate.toString()).toBe('Invalid Date')
      })

      it('should create Invalid Date from NaN', () => {
        const invalidDate = new Date(NaN)

        expect(isNaN(invalidDate.getTime())).toBe(true)
      })

      it('should detect Invalid Date', () => {
        const invalid = new Date('invalid')
        const valid = new Date('2024-01-15')

        expect(Number.isNaN(invalid.getTime())).toBe(true)
        expect(Number.isNaN(valid.getTime())).toBe(false)
      })
    })

    describe('Edge case date strings', () => {
      it('should handle leap year February 29', () => {
        const leapDay = new Date('2024-02-29')

        expect(leapDay.getUTCMonth()).toBe(1) // February
        expect(leapDay.getUTCDate()).toBe(29)
      })

      it('should rollover non-leap year February 29', () => {
        const nonLeapDay = new Date('2023-02-29')

        // JavaScript rolls over to March 1
        expect(nonLeapDay.getUTCMonth()).toBe(2) // March
        expect(nonLeapDay.getUTCDate()).toBe(1)
      })

      it('should handle month rollover', () => {
        const rollover = new Date(Date.UTC(2024, 0, 32)) // Jan 32

        // Rolls over to February 1
        expect(rollover.getUTCMonth()).toBe(1)
        expect(rollover.getUTCDate()).toBe(1)
      })
    })
  })

  // ============================================================================
  // DynamoDB Date Handling
  // ============================================================================
  describe('DynamoDB date handling', () => {
    describe('Date as ISO string', () => {
      it('should store date as ISO string', () => {
        const date = new Date('2024-01-15T10:30:00Z')
        const marshalled = marshall({ createdAt: date.toISOString() })

        expect(marshalled.createdAt).toEqual({ S: '2024-01-15T10:30:00.000Z' })
      })

      it('should retrieve and parse ISO string', () => {
        const dynamoItem = {
          createdAt: { S: '2024-01-15T10:30:00.000Z' },
        }

        const unmarshalled = unmarshall(dynamoItem)
        const date = new Date(unmarshalled.createdAt)

        expect(date.toISOString()).toBe('2024-01-15T10:30:00.000Z')
      })
    })

    describe('Date as epoch timestamp', () => {
      it('should store date as epoch milliseconds', () => {
        const date = new Date('2024-01-15T10:30:00Z')
        const marshalled = marshall({ timestamp: date.getTime() })

        expect(marshalled.timestamp).toEqual({ N: '1705314600000' })
      })

      it('should retrieve and parse epoch timestamp', () => {
        const timestamp = 1705314600000
        const dynamoItem = {
          timestamp: { N: timestamp.toString() },
        }

        const unmarshalled = unmarshall(dynamoItem)
        const date = new Date(unmarshalled.timestamp)

        expect(date.toISOString()).toBe('2024-01-15T10:30:00.000Z')
      })
    })

    describe('Date object marshalling', () => {
      it('should marshall Date object with convertClassInstanceToMap', () => {
        const date = new Date('2024-01-15T10:30:00Z')
        const marshalled = marshall(
          { date },
          { convertClassInstanceToMap: true },
        )

        // Date becomes a Map with internal properties
        expect(marshalled.date.M).toBeDefined()
      })
    })
  })

  // ============================================================================
  // class-transformer Date Handling
  // ============================================================================
  describe('class-transformer date handling', () => {
    describe('Date transformation', () => {
      class DateDto {
        @Transform(({ value }) => new Date(value), { toClassOnly: true })
        @Transform(({ value }) => value.toISOString(), { toPlainOnly: true })
        date: Date
      }

      it('should transform ISO string to Date', () => {
        const plain = { date: '2024-01-15T10:30:00Z' }
        const instance = plainToInstance(DateDto, plain)

        expect(instance.date).toBeInstanceOf(Date)
        expect(instance.date.toISOString()).toBe('2024-01-15T10:30:00.000Z')
      })

      it('should transform Date to ISO string', () => {
        const instance = new DateDto()
        instance.date = new Date('2024-01-15T10:30:00Z')

        const plain = instanceToPlain(instance)

        expect(plain.date).toBe('2024-01-15T10:30:00.000Z')
      })

      it('should handle null date', () => {
        const plain = { date: null }
        const instance = plainToInstance(DateDto, plain)

        // Transform receives null, but new Date(null) returns epoch date
        // This documents the actual behavior
        expect(instance.date).toBeInstanceOf(Date)
        expect(instance.date.getTime()).toBe(0) // Epoch time
      })
    })

    describe('@Type decorator with Date', () => {
      class TypedDateDto {
        @Type(() => Date)
        date: Date
      }

      it('should transform with @Type to Date', () => {
        const plain = { date: '2024-01-15T10:30:00Z' }
        const instance = plainToInstance(TypedDateDto, plain)

        // @Type(() => Date) creates Date from string
        expect(instance.date).toBeInstanceOf(Date)
      })

      it('should handle timestamp with @Type', () => {
        const plain = { date: 1705314600000 }
        const instance = plainToInstance(TypedDateDto, plain)

        expect(instance.date).toBeInstanceOf(Date)
        expect(instance.date.getTime()).toBe(1705314600000)
      })
    })
  })

  // ============================================================================
  // class-validator Date Validation
  // ============================================================================
  describe('class-validator date validation', () => {
    describe('@IsDate validation', () => {
      class DateValidationDto {
        @IsDate()
        @Type(() => Date)
        date: Date
      }

      it('should validate valid Date', async () => {
        const instance = plainToInstance(DateValidationDto, {
          date: '2024-01-15T10:30:00Z',
        })

        const errors = await validate(instance)
        expect(errors).toHaveLength(0)
      })

      it('should reject invalid Date', async () => {
        const instance = plainToInstance(DateValidationDto, {
          date: 'not-a-date',
        })

        const errors = await validate(instance)
        expect(errors.length).toBeGreaterThan(0)
        expect(errors[0].property).toBe('date')
      })
    })

    describe('@IsISO8601 validation', () => {
      class ISO8601Dto {
        @IsISO8601()
        dateString: string
      }

      it('should validate valid ISO 8601 string', async () => {
        const instance = plainToInstance(ISO8601Dto, {
          dateString: '2024-01-15T10:30:00Z',
        })

        const errors = await validate(instance)
        expect(errors).toHaveLength(0)
      })

      it('should validate ISO 8601 with timezone offset', async () => {
        const instance = plainToInstance(ISO8601Dto, {
          dateString: '2024-01-15T10:30:00+09:00',
        })

        const errors = await validate(instance)
        expect(errors).toHaveLength(0)
      })

      it('should reject non-ISO 8601 string', async () => {
        const instance = plainToInstance(ISO8601Dto, {
          dateString: 'January 15, 2024',
        })

        const errors = await validate(instance)
        expect(errors.length).toBeGreaterThan(0)
        expect(errors[0].property).toBe('dateString')
      })
    })
  })

  // ============================================================================
  // Date Arithmetic
  // ============================================================================
  describe('Date arithmetic', () => {
    describe('Adding and subtracting time', () => {
      it('should add days to date', () => {
        const date = new Date('2024-01-15T00:00:00Z')
        const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000)

        expect(nextDay.toISOString()).toBe('2024-01-16T00:00:00.000Z')
      })

      it('should subtract days from date', () => {
        const date = new Date('2024-01-15T00:00:00Z')
        const prevDay = new Date(date.getTime() - 24 * 60 * 60 * 1000)

        expect(prevDay.toISOString()).toBe('2024-01-14T00:00:00.000Z')
      })

      it('should handle month boundaries', () => {
        const lastJan = new Date('2024-01-31T00:00:00Z')
        const nextDay = new Date(lastJan.getTime() + 24 * 60 * 60 * 1000)

        expect(nextDay.getUTCMonth()).toBe(1) // February
        expect(nextDay.getUTCDate()).toBe(1)
      })

      it('should handle year boundaries', () => {
        const lastDay = new Date('2023-12-31T23:59:59Z')
        const nextSecond = new Date(lastDay.getTime() + 1000)

        expect(nextSecond.getUTCFullYear()).toBe(2024)
        expect(nextSecond.getUTCMonth()).toBe(0) // January
        expect(nextSecond.getUTCDate()).toBe(1)
      })
    })

    describe('Date comparison', () => {
      it('should compare dates using getTime', () => {
        const date1 = new Date('2024-01-15T00:00:00Z')
        const date2 = new Date('2024-01-16T00:00:00Z')

        expect(date1.getTime()).toBeLessThan(date2.getTime())
        expect(date2.getTime()).toBeGreaterThan(date1.getTime())
      })

      it('should check date equality using getTime', () => {
        const date1 = new Date('2024-01-15T10:30:00Z')
        const date2 = new Date('2024-01-15T10:30:00Z')

        // Direct comparison returns false (different objects)
        expect(date1 === date2).toBe(false)

        // Compare timestamps for equality
        expect(date1.getTime()).toBe(date2.getTime())
      })
    })
  })

  // ============================================================================
  // Duration and Interval Handling
  // ============================================================================
  describe('Duration and interval handling', () => {
    describe('Calculate duration between dates', () => {
      it('should calculate milliseconds between dates', () => {
        const start = new Date('2024-01-15T10:00:00Z')
        const end = new Date('2024-01-15T11:30:00Z')

        const durationMs = end.getTime() - start.getTime()
        const durationMinutes = durationMs / (1000 * 60)

        expect(durationMs).toBe(90 * 60 * 1000)
        expect(durationMinutes).toBe(90)
      })

      it('should calculate days between dates', () => {
        const start = new Date('2024-01-01T00:00:00Z')
        const end = new Date('2024-01-15T00:00:00Z')

        const durationMs = end.getTime() - start.getTime()
        const days = durationMs / (1000 * 60 * 60 * 24)

        expect(days).toBe(14)
      })
    })

    describe('ISO 8601 duration format', () => {
      // Helper to parse ISO 8601 duration
      const parseDuration = (duration: string): number => {
        const match = duration.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
        if (!match) return 0

        const days = parseInt(match[1] || '0', 10)
        const hours = parseInt(match[2] || '0', 10)
        const minutes = parseInt(match[3] || '0', 10)
        const seconds = parseInt(match[4] || '0', 10)

        return (
          days * 24 * 60 * 60 * 1000 +
          hours * 60 * 60 * 1000 +
          minutes * 60 * 1000 +
          seconds * 1000
        )
      }

      it('should parse ISO 8601 duration', () => {
        expect(parseDuration('PT1H')).toBe(3600000) // 1 hour
        expect(parseDuration('PT30M')).toBe(1800000) // 30 minutes
        expect(parseDuration('P1D')).toBe(86400000) // 1 day
        expect(parseDuration('PT1H30M')).toBe(5400000) // 1.5 hours
      })
    })
  })
})
