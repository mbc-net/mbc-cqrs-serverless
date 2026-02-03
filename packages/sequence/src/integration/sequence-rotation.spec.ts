/**
 * Sequence Rotation Integration Tests
 *
 * This file tests the sequence rotation behavior:
 * - Time-based rotation (daily, monthly, yearly, fiscal yearly)
 * - Rotation value calculation
 * - Fiscal year handling
 *
 * These tests verify that sequence rotation works correctly across
 * package version updates.
 */
import { RotateByEnum } from '../enums/rotate-by.enum'

describe('Sequence Rotation Behavior', () => {
  // ============================================================================
  // RotateByEnum Tests
  // ============================================================================
  describe('RotateByEnum', () => {
    describe('Enum values', () => {
      it('should have FISCAL_YEARLY value', () => {
        expect(RotateByEnum.FISCAL_YEARLY).toBe('fiscal_yearly')
      })

      it('should have YEARLY value', () => {
        expect(RotateByEnum.YEARLY).toBe('yearly')
      })

      it('should have MONTHLY value', () => {
        expect(RotateByEnum.MONTHLY).toBe('monthly')
      })

      it('should have DAILY value', () => {
        expect(RotateByEnum.DAILY).toBe('daily')
      })

      it('should have NONE value', () => {
        expect(RotateByEnum.NONE).toBe('none')
      })
    })

    describe('Enum completeness', () => {
      it('should have exactly 5 rotation types', () => {
        const values = Object.values(RotateByEnum)
        expect(values).toHaveLength(5)
      })

      it('should contain all expected values', () => {
        const values = Object.values(RotateByEnum)
        expect(values).toContain('fiscal_yearly')
        expect(values).toContain('yearly')
        expect(values).toContain('monthly')
        expect(values).toContain('daily')
        expect(values).toContain('none')
      })
    })
  })

  // ============================================================================
  // Rotation Value Calculation Tests
  // ============================================================================
  describe('Rotation Value Calculation', () => {
    /**
     * Helper function to calculate rotation value based on date and rotation type
     * This mirrors the logic in SequencesService
     */
    function calculateRotateValue(
      date: Date,
      rotateBy: RotateByEnum,
      fiscalYearStartMonth = 4,
    ): string {
      const year = date.getFullYear()
      const month = date.getMonth() + 1 // 1-indexed
      const day = date.getDate()

      switch (rotateBy) {
        case RotateByEnum.DAILY:
          return `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`

        case RotateByEnum.MONTHLY:
          return `${year}${String(month).padStart(2, '0')}`

        case RotateByEnum.YEARLY:
          return `${year}`

        case RotateByEnum.FISCAL_YEARLY:
          // Fiscal year: if current month < start month, use previous year
          const fiscalYear =
            month < fiscalYearStartMonth ? year - 1 : year
          return `FY${fiscalYear}`

        case RotateByEnum.NONE:
        default:
          return ''
      }
    }

    describe('Daily rotation', () => {
      it('should calculate daily rotation value', () => {
        const date = new Date('2024-03-15')
        const value = calculateRotateValue(date, RotateByEnum.DAILY)
        expect(value).toBe('20240315')
      })

      it('should pad single-digit months and days', () => {
        const date = new Date('2024-01-05')
        const value = calculateRotateValue(date, RotateByEnum.DAILY)
        expect(value).toBe('20240105')
      })

      it('should handle year boundaries', () => {
        const dec31 = new Date('2024-12-31')
        const jan1 = new Date('2025-01-01')

        expect(calculateRotateValue(dec31, RotateByEnum.DAILY)).toBe('20241231')
        expect(calculateRotateValue(jan1, RotateByEnum.DAILY)).toBe('20250101')
      })
    })

    describe('Monthly rotation', () => {
      it('should calculate monthly rotation value', () => {
        const date = new Date('2024-03-15')
        const value = calculateRotateValue(date, RotateByEnum.MONTHLY)
        expect(value).toBe('202403')
      })

      it('should pad single-digit months', () => {
        const date = new Date('2024-01-01')
        const value = calculateRotateValue(date, RotateByEnum.MONTHLY)
        expect(value).toBe('202401')
      })

      it('should handle different days in same month', () => {
        const day1 = new Date('2024-03-01')
        const day15 = new Date('2024-03-15')
        const day31 = new Date('2024-03-31')

        const value1 = calculateRotateValue(day1, RotateByEnum.MONTHLY)
        const value15 = calculateRotateValue(day15, RotateByEnum.MONTHLY)
        const value31 = calculateRotateValue(day31, RotateByEnum.MONTHLY)

        expect(value1).toBe(value15)
        expect(value15).toBe(value31)
        expect(value1).toBe('202403')
      })
    })

    describe('Yearly rotation', () => {
      it('should calculate yearly rotation value', () => {
        const date = new Date('2024-03-15')
        const value = calculateRotateValue(date, RotateByEnum.YEARLY)
        expect(value).toBe('2024')
      })

      it('should handle different dates in same year', () => {
        const jan = new Date('2024-01-01')
        const jun = new Date('2024-06-15')
        const dec = new Date('2024-12-31')

        expect(calculateRotateValue(jan, RotateByEnum.YEARLY)).toBe('2024')
        expect(calculateRotateValue(jun, RotateByEnum.YEARLY)).toBe('2024')
        expect(calculateRotateValue(dec, RotateByEnum.YEARLY)).toBe('2024')
      })
    })

    describe('Fiscal yearly rotation', () => {
      it('should use current year after fiscal year start (April)', () => {
        // April is month 4, which is >= fiscalYearStartMonth(4)
        const apr = new Date('2024-04-01')
        const value = calculateRotateValue(apr, RotateByEnum.FISCAL_YEARLY, 4)
        expect(value).toBe('FY2024')
      })

      it('should use previous year before fiscal year start', () => {
        // March is month 3, which is < fiscalYearStartMonth(4)
        const mar = new Date('2024-03-31')
        const value = calculateRotateValue(mar, RotateByEnum.FISCAL_YEARLY, 4)
        expect(value).toBe('FY2023')
      })

      it('should handle fiscal year boundary', () => {
        const marchEnd = new Date('2024-03-31')
        const aprilStart = new Date('2024-04-01')

        const marchFY = calculateRotateValue(
          marchEnd,
          RotateByEnum.FISCAL_YEARLY,
          4,
        )
        const aprilFY = calculateRotateValue(
          aprilStart,
          RotateByEnum.FISCAL_YEARLY,
          4,
        )

        expect(marchFY).toBe('FY2023')
        expect(aprilFY).toBe('FY2024')
      })

      it('should handle custom fiscal year start month', () => {
        // October start (common US fiscal year)
        const sept = new Date('2024-09-30')
        const oct = new Date('2024-10-01')

        const septFY = calculateRotateValue(
          sept,
          RotateByEnum.FISCAL_YEARLY,
          10,
        )
        const octFY = calculateRotateValue(oct, RotateByEnum.FISCAL_YEARLY, 10)

        expect(septFY).toBe('FY2023')
        expect(octFY).toBe('FY2024')
      })

      it('should handle January fiscal year start', () => {
        const dec = new Date('2024-12-31')
        const jan = new Date('2025-01-01')

        const decFY = calculateRotateValue(dec, RotateByEnum.FISCAL_YEARLY, 1)
        const janFY = calculateRotateValue(jan, RotateByEnum.FISCAL_YEARLY, 1)

        expect(decFY).toBe('FY2024')
        expect(janFY).toBe('FY2025')
      })
    })

    describe('No rotation', () => {
      it('should return empty string for NONE rotation', () => {
        const date = new Date('2024-03-15')
        const value = calculateRotateValue(date, RotateByEnum.NONE)
        expect(value).toBe('')
      })
    })
  })

  // ============================================================================
  // Sequence Key Format Tests
  // ============================================================================
  describe('Sequence Key Format', () => {
    const KEY_SEPARATOR = '#'

    /**
     * Generates a sequence sort key based on type code, params, and rotation
     */
    function generateSequenceSk(
      typeCode: string,
      params: {
        code1?: string
        code2?: string
        code3?: string
        code4?: string
        code5?: string
      },
      rotateValue: string,
    ): string {
      const parts = [
        typeCode,
        params.code1,
        params.code2,
        params.code3,
        params.code4,
        params.code5,
        rotateValue,
      ].filter(Boolean)

      return parts.join(KEY_SEPARATOR)
    }

    it('should generate simple sequence key', () => {
      const sk = generateSequenceSk('ORDER', {}, '20240315')
      expect(sk).toBe('ORDER#20240315')
    })

    it('should include code parameters in key', () => {
      const sk = generateSequenceSk(
        'INVOICE',
        { code1: 'SALES', code2: 'TOKYO' },
        '202403',
      )
      expect(sk).toBe('INVOICE#SALES#TOKYO#202403')
    })

    it('should skip undefined parameters', () => {
      const sk = generateSequenceSk(
        'DOC',
        { code1: 'A', code3: 'C' }, // code2 is undefined
        'FY2024',
      )
      // Note: this will result in 'DOC#A#C#FY2024', not 'DOC#A##C#FY2024'
      expect(sk).toBe('DOC#A#C#FY2024')
    })

    it('should handle no rotation value', () => {
      const sk = generateSequenceSk('MASTER', { code1: 'CONFIG' }, '')
      expect(sk).toBe('MASTER#CONFIG')
    })

    it('should handle all 5 code parameters', () => {
      const sk = generateSequenceSk(
        'COMPLEX',
        {
          code1: 'A',
          code2: 'B',
          code3: 'C',
          code4: 'D',
          code5: 'E',
        },
        '2024',
      )
      expect(sk).toBe('COMPLEX#A#B#C#D#E#2024')
    })
  })

  // ============================================================================
  // Sequence Format Tests
  // ============================================================================
  describe('Sequence Number Formatting', () => {
    /**
     * Formats a sequence number based on a format string
     * Format placeholders:
     * - {seq} or {seq:N} - sequence number with N digits padding
     * - {year} - 4-digit year
     * - {month} - 2-digit month
     * - {day} - 2-digit day
     * - {fiscalYear} - fiscal year
     */
    function formatSequenceNumber(
      format: string,
      seq: number,
      date: Date,
      fiscalYear?: number,
    ): string {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')

      let result = format

      // Handle {seq:N} format with padding
      const seqMatch = format.match(/\{seq:(\d+)\}/)
      if (seqMatch) {
        const padding = parseInt(seqMatch[1], 10)
        result = result.replace(seqMatch[0], String(seq).padStart(padding, '0'))
      } else {
        result = result.replace('{seq}', String(seq))
      }

      result = result
        .replace('{year}', String(year))
        .replace('{month}', month)
        .replace('{day}', day)

      if (fiscalYear !== undefined) {
        result = result.replace('{fiscalYear}', String(fiscalYear))
      }

      return result
    }

    it('should format with simple sequence', () => {
      const formatted = formatSequenceNumber(
        'ORD-{seq}',
        1,
        new Date('2024-03-15'),
      )
      expect(formatted).toBe('ORD-1')
    })

    it('should format with zero-padded sequence', () => {
      const formatted = formatSequenceNumber(
        'INV-{seq:6}',
        42,
        new Date('2024-03-15'),
      )
      expect(formatted).toBe('INV-000042')
    })

    it('should include date components', () => {
      const formatted = formatSequenceNumber(
        '{year}{month}{day}-{seq:4}',
        123,
        new Date('2024-03-15'),
      )
      expect(formatted).toBe('20240315-0123')
    })

    it('should include fiscal year', () => {
      const formatted = formatSequenceNumber(
        'FY{fiscalYear}-{seq:5}',
        1,
        new Date('2024-03-15'),
        2023, // March is in FY2023 for April-start fiscal year
      )
      expect(formatted).toBe('FY2023-00001')
    })

    it('should handle complex format', () => {
      const formatted = formatSequenceNumber(
        'DOC-{year}-{month}-{seq:8}',
        12345,
        new Date('2024-01-05'),
      )
      expect(formatted).toBe('DOC-2024-01-00012345')
    })

    it('should handle sequence overflow beyond padding', () => {
      const formatted = formatSequenceNumber(
        '{seq:3}',
        12345, // More than 3 digits
        new Date('2024-03-15'),
      )
      expect(formatted).toBe('12345') // No truncation, just no padding needed
    })
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================
  describe('Edge Cases', () => {
    describe('Leap year handling', () => {
      it('should handle Feb 29 in leap year', () => {
        const leapDate = new Date('2024-02-29')
        expect(leapDate.getDate()).toBe(29)
        expect(leapDate.getMonth()).toBe(1) // February is 1 (0-indexed)
      })
    })

    describe('Timezone considerations', () => {
      it('should use local date for rotation calculation', () => {
        // Create dates that might span day boundary in different timezones
        const date = new Date('2024-03-15T00:00:00')
        expect(date.getFullYear()).toBe(2024)
        expect(date.getMonth() + 1).toBe(3)
        expect(date.getDate()).toBe(15)
      })
    })

    describe('Year boundaries', () => {
      it('should handle year transition correctly', () => {
        const lastDayOfYear = new Date('2024-12-31')
        const firstDayOfYear = new Date('2025-01-01')

        expect(lastDayOfYear.getFullYear()).toBe(2024)
        expect(firstDayOfYear.getFullYear()).toBe(2025)
      })
    })
  })
})
