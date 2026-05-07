/**
 * Edge Cases Tests
 *
 * These tests verify how external libraries handle edge cases and special values.
 * When libraries change their edge case handling, these tests will fail.
 */

import 'reflect-metadata'

import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import { instanceToPlain, plainToInstance, Type } from 'class-transformer'
import {
  IsNumber,
  IsOptional,
  IsString,
  validate,
  ValidateNested,
} from 'class-validator'

describe('Edge Cases Tests', () => {
  describe('Null and Undefined handling', () => {
    describe('class-transformer with null/undefined', () => {
      class NullableClass {
        @IsOptional()
        nullableField: string | null
        optionalField?: string
      }

      it('should handle null values in plainToInstance', () => {
        const plain = { nullableField: null }
        const instance = plainToInstance(NullableClass, plain)

        expect(instance.nullableField).toBeNull()
      })

      it('should handle undefined values in plainToInstance', () => {
        const plain = { nullableField: undefined }
        const instance = plainToInstance(NullableClass, plain)

        expect(instance.nullableField).toBeUndefined()
      })

      it('should handle missing properties', () => {
        const plain = {}
        const instance = plainToInstance(NullableClass, plain)

        expect(instance.nullableField).toBeUndefined()
        expect(instance.optionalField).toBeUndefined()
      })

      it('should preserve null in instanceToPlain', () => {
        const instance = new NullableClass()
        instance.nullableField = null

        const plain = instanceToPlain(instance)

        expect(plain.nullableField).toBeNull()
      })
    })

    describe('DynamoDB marshall with null/undefined', () => {
      it('should marshall null to NULL type', () => {
        const result = marshall({ value: null })
        expect(result.value).toEqual({ NULL: true })
      })

      it('should handle undefined with removeUndefinedValues', () => {
        const result = marshall(
          { defined: 'value', notDefined: undefined },
          { removeUndefinedValues: true },
        )

        expect(result.defined).toBeDefined()
        expect(result.notDefined).toBeUndefined()
      })
    })
  })

  describe('Empty values handling', () => {
    describe('Empty strings', () => {
      it('class-transformer should preserve empty strings', () => {
        class EmptyStringClass {
          value: string
        }

        const instance = plainToInstance(EmptyStringClass, { value: '' })
        expect(instance.value).toBe('')

        const plain = instanceToPlain(instance)
        expect(plain.value).toBe('')
      })

      it('DynamoDB should handle empty strings', () => {
        const marshalled = marshall({ emptyStr: '' })
        const unmarshalled = unmarshall(marshalled)

        expect(unmarshalled.emptyStr).toBe('')
      })

      it('DynamoDB should convert empty string to NULL with option', () => {
        const marshalled = marshall(
          { emptyStr: '' },
          { convertEmptyValues: true },
        )

        expect(marshalled.emptyStr).toEqual({ NULL: true })
      })
    })

    describe('Empty arrays and objects', () => {
      it('class-transformer should preserve empty arrays', () => {
        class ArrayClass {
          @Type(() => String)
          items: string[]
        }

        const instance = plainToInstance(ArrayClass, { items: [] })
        expect(instance.items).toEqual([])
        expect(Array.isArray(instance.items)).toBe(true)
      })

      it('class-transformer should preserve empty objects', () => {
        class ObjectClass {
          data: object
        }

        const instance = plainToInstance(ObjectClass, { data: {} })
        expect(instance.data).toEqual({})
      })

      it('DynamoDB should handle empty arrays', () => {
        const original = { arr: [] as unknown[] }
        const marshalled = marshall(original)
        const unmarshalled = unmarshall(marshalled)

        expect(unmarshalled.arr).toEqual([])
      })

      it('DynamoDB should handle empty objects', () => {
        const original = { obj: {} }
        const marshalled = marshall(original)
        const unmarshalled = unmarshall(marshalled)

        expect(unmarshalled.obj).toEqual({})
      })
    })
  })

  describe('Special number handling', () => {
    describe('Number edge cases', () => {
      it('should handle zero', () => {
        const marshalled = marshall({ zero: 0 })
        const unmarshalled = unmarshall(marshalled)

        expect(unmarshalled.zero).toBe(0)
        expect(Object.is(unmarshalled.zero, 0)).toBe(true)
      })

      it('should handle negative zero', () => {
        const marshalled = marshall({ negZero: -0 })
        const unmarshalled = unmarshall(marshalled)

        // DynamoDB treats -0 as 0
        expect(unmarshalled.negZero).toBe(0)
      })

      it('should handle MAX_SAFE_INTEGER', () => {
        const value = Number.MAX_SAFE_INTEGER
        const marshalled = marshall({ max: value })
        const unmarshalled = unmarshall(marshalled)

        expect(unmarshalled.max).toBe(value)
      })

      it('should handle MIN_SAFE_INTEGER', () => {
        const value = Number.MIN_SAFE_INTEGER
        const marshalled = marshall({ min: value })
        const unmarshalled = unmarshall(marshalled)

        expect(unmarshalled.min).toBe(value)
      })

      it('should handle very small decimals', () => {
        const value = 0.000000001
        const marshalled = marshall({ small: value })
        const unmarshalled = unmarshall(marshalled)

        expect(unmarshalled.small).toBeCloseTo(value, 10)
      })

      it('should handle negative numbers', () => {
        const marshalled = marshall({ neg: -42.5 })
        const unmarshalled = unmarshall(marshalled)

        expect(unmarshalled.neg).toBe(-42.5)
      })
    })

    describe('class-validator number validation', () => {
      class NumberClass {
        @IsNumber()
        value: number
      }

      it('should validate zero', async () => {
        const instance = plainToInstance(NumberClass, { value: 0 })
        const errors = await validate(instance)

        expect(errors).toHaveLength(0)
      })

      it('should validate negative numbers', async () => {
        const instance = plainToInstance(NumberClass, { value: -100 })
        const errors = await validate(instance)

        expect(errors).toHaveLength(0)
      })

      it('should validate decimals', async () => {
        const instance = plainToInstance(NumberClass, { value: 3.14159 })
        const errors = await validate(instance)

        expect(errors).toHaveLength(0)
      })

      it('should reject NaN', async () => {
        const instance = plainToInstance(NumberClass, { value: NaN })
        const errors = await validate(instance)

        expect(errors.length).toBeGreaterThan(0)
      })

      it('should reject Infinity', async () => {
        const instance = plainToInstance(NumberClass, { value: Infinity })
        const errors = await validate(instance)

        expect(errors.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Unicode and special characters', () => {
    it('should handle Japanese characters', () => {
      const original = { text: '日本語テスト' }
      const marshalled = marshall(original)
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled.text).toBe('日本語テスト')
    })

    it('should handle emoji', () => {
      const original = { emoji: '🎉🚀💻🌍' }
      const marshalled = marshall(original)
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled.emoji).toBe('🎉🚀💻🌍')
    })

    it('should handle mixed scripts', () => {
      const original = { mixed: 'Hello 世界 مرحبا 🌐' }
      const marshalled = marshall(original)
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled.mixed).toBe('Hello 世界 مرحبا 🌐')
    })

    it('should handle newlines and tabs', () => {
      const original = { whitespace: 'line1\nline2\ttabbed' }
      const marshalled = marshall(original)
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled.whitespace).toBe('line1\nline2\ttabbed')
    })

    it('should handle special JSON characters', () => {
      const original = { special: '"quoted" and \\backslash\\' }
      const marshalled = marshall(original)
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled.special).toBe('"quoted" and \\backslash\\')
    })
  })

  describe('Deeply nested structures', () => {
    it('should handle 10 levels of nesting', () => {
      const createNested = (depth: number, value: string): object => {
        if (depth === 0) return { value }
        return { nested: createNested(depth - 1, value) }
      }

      const original = createNested(10, 'deep-value')
      const marshalled = marshall(original)
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled).toEqual(original)
    })

    it('class-transformer should handle deeply nested objects', () => {
      class Level3 {
        value: string
      }

      class Level2 {
        @Type(() => Level3)
        level3: Level3
      }

      class Level1 {
        @Type(() => Level2)
        level2: Level2
      }

      class Root {
        @Type(() => Level1)
        level1: Level1
      }

      const plain = {
        level1: {
          level2: {
            level3: {
              value: 'deep',
            },
          },
        },
      }

      const instance = plainToInstance(Root, plain)

      expect(instance.level1.level2.level3.value).toBe('deep')
    })

    it('class-validator should validate deeply nested objects', async () => {
      class InnerClass {
        @IsString()
        value: string
      }

      class MiddleClass {
        @ValidateNested()
        @Type(() => InnerClass)
        inner: InnerClass
      }

      class OuterClass {
        @ValidateNested()
        @Type(() => MiddleClass)
        middle: MiddleClass
      }

      const valid = plainToInstance(OuterClass, {
        middle: { inner: { value: 'string' } },
      })
      const invalid = plainToInstance(OuterClass, {
        middle: { inner: { value: 123 } },
      })

      expect(await validate(valid)).toHaveLength(0)
      expect((await validate(invalid)).length).toBeGreaterThan(0)
    })
  })

  describe('Large data handling', () => {
    it('should handle array with 1000 items', () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        value: `item-${i}`,
      }))

      const original = { items: largeArray }
      const marshalled = marshall(original)
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled.items).toHaveLength(1000)
      expect((unmarshalled.items as { id: number }[])[999].id).toBe(999)
    })

    it('should handle object with 100 properties', () => {
      const largeObject: Record<string, number> = {}
      for (let i = 0; i < 100; i++) {
        largeObject[`prop${i}`] = i
      }

      const marshalled = marshall(largeObject)
      const unmarshalled = unmarshall(marshalled)

      expect(Object.keys(unmarshalled)).toHaveLength(100)
      expect((unmarshalled as Record<string, number>).prop99).toBe(99)
    })

    it('should handle long strings', () => {
      const longString = 'x'.repeat(10000)
      const original = { text: longString }

      const marshalled = marshall(original)
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled.text).toBe(longString)
      expect((unmarshalled.text as string).length).toBe(10000)
    })
  })

  describe('Type coercion edge cases', () => {
    describe('String to number coercion in class-transformer', () => {
      class CoercionClass {
        value: number
      }

      it('should not coerce string to number by default', () => {
        const instance = plainToInstance(CoercionClass, { value: '42' })

        // Default behavior: string stays as string
        expect(instance.value).toBe('42')
      })
    })

    describe('Boolean coercion', () => {
      class BooleanClass {
        flag: boolean
      }

      it('should not coerce string "true" to boolean', () => {
        const instance = plainToInstance(BooleanClass, { flag: 'true' })

        expect(instance.flag).toBe('true')
      })

      it('should not coerce number 1 to boolean', () => {
        const instance = plainToInstance(BooleanClass, { flag: 1 })

        expect(instance.flag).toBe(1)
      })
    })
  })

  describe('Date handling', () => {
    it('DynamoDB should handle ISO date strings', () => {
      const isoDate = '2024-01-15T10:30:00.000Z'
      const original = { date: isoDate }

      const marshalled = marshall(original)
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled.date).toBe(isoDate)
    })

    it('DynamoDB should handle Date objects as strings', () => {
      const date = new Date('2024-01-15T10:30:00.000Z')
      const original = { date: date.toISOString() }

      const marshalled = marshall(original)
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled.date).toBe(date.toISOString())
    })
  })

  describe('Binary data handling', () => {
    it('should handle Uint8Array', () => {
      const binary = new Uint8Array([0, 127, 255])
      const original = { data: binary }

      const marshalled = marshall(original)
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled.data).toBeInstanceOf(Uint8Array)
      expect(Array.from(unmarshalled.data as Uint8Array)).toEqual([0, 127, 255])
    })

    it('should handle Buffer', () => {
      const buffer = Buffer.from([1, 2, 3, 4, 5])
      const original = { data: buffer }

      const marshalled = marshall(original)
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled.data).toBeDefined()
    })
  })

  describe('Set handling in DynamoDB', () => {
    it('should handle Set of strings', () => {
      const original = { tags: new Set(['a', 'b', 'c']) }
      const marshalled = marshall(original)
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled.tags).toBeInstanceOf(Set)
      expect(unmarshalled.tags).toEqual(new Set(['a', 'b', 'c']))
    })

    it('should handle Set of numbers', () => {
      const original = { numbers: new Set([1, 2, 3]) }
      const marshalled = marshall(original)
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled.numbers).toBeInstanceOf(Set)
      expect(unmarshalled.numbers).toEqual(new Set([1, 2, 3]))
    })

    it('should handle empty Set with convertEmptyValues', () => {
      const original = { emptySet: new Set<string>() }
      const marshalled = marshall(original, { convertEmptyValues: true })

      expect(marshalled.emptySet).toEqual({ NULL: true })
    })
  })
})
