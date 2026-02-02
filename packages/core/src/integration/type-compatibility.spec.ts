/**
 * Type Compatibility Tests
 *
 * These tests verify that external packages maintain expected behavior
 * for type conversions and data transformations. When a package changes
 * how it handles certain data types, these tests will fail.
 */

import 'reflect-metadata'

import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'

describe('Type Compatibility', () => {
  describe('marshall/unmarshall round-trip', () => {
    it('should preserve primitive types', () => {
      const original = {
        string: 'test',
        number: 42,
        float: 3.14,
        boolean: true,
        null: null,
      }
      const marshalled = marshall(original)
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled).toEqual(original)
      expect(typeof unmarshalled.string).toBe('string')
      expect(typeof unmarshalled.number).toBe('number')
      expect(typeof unmarshalled.float).toBe('number')
      expect(typeof unmarshalled.boolean).toBe('boolean')
      expect(unmarshalled.null).toBeNull()
    })

    it('should preserve array types', () => {
      const original = {
        numberArray: [1, 2, 3],
        stringArray: ['a', 'b', 'c'],
        mixedArray: [1, 'two', true],
      }
      const marshalled = marshall(original)
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled).toEqual(original)
      expect(Array.isArray(unmarshalled.numberArray)).toBe(true)
      expect(Array.isArray(unmarshalled.stringArray)).toBe(true)
      expect(Array.isArray(unmarshalled.mixedArray)).toBe(true)
    })

    it('should preserve nested object types', () => {
      const original = {
        nested: {
          deep: {
            value: 'test',
            number: 123,
          },
        },
      }
      const marshalled = marshall(original)
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled).toEqual(original)
      expect(typeof unmarshalled.nested).toBe('object')
      expect(typeof unmarshalled.nested.deep).toBe('object')
    })

    it('should handle empty values correctly', () => {
      const original = {
        emptyString: '',
        emptyArray: [] as unknown[],
        emptyObject: {},
      }
      const marshalled = marshall(original, { removeUndefinedValues: true })
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled.emptyString).toBe('')
      expect(Array.isArray(unmarshalled.emptyArray)).toBe(true)
      expect(unmarshalled.emptyArray).toHaveLength(0)
    })

    it('should handle large numbers correctly', () => {
      const original = {
        largeInt: 9007199254740991, // Number.MAX_SAFE_INTEGER
        smallInt: -9007199254740991,
        zero: 0,
        negative: -42,
      }
      const marshalled = marshall(original)
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled.largeInt).toBe(original.largeInt)
      expect(unmarshalled.smallInt).toBe(original.smallInt)
      expect(unmarshalled.zero).toBe(0)
      expect(unmarshalled.negative).toBe(-42)
    })

    it('should handle special string characters', () => {
      const original = {
        unicode: '日本語テスト',
        emoji: '🎉🚀',
        special: 'line1\nline2\ttab',
        empty: '',
      }
      const marshalled = marshall(original)
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled).toEqual(original)
    })

    it('should handle nested arrays', () => {
      const original = {
        matrix: [
          [1, 2, 3],
          [4, 5, 6],
        ],
        nested: [{ a: 1 }, { b: 2 }],
      }
      const marshalled = marshall(original)
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled).toEqual(original)
      expect(unmarshalled.matrix[0][0]).toBe(1)
      expect(unmarshalled.nested[0].a).toBe(1)
    })

    it('should handle removeUndefinedValues option', () => {
      const original = {
        defined: 'value',
        undefined: undefined,
      }
      const marshalled = marshall(original, { removeUndefinedValues: true })
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled.defined).toBe('value')
      expect('undefined' in unmarshalled).toBe(false)
    })
  })

  describe('class-transformer compatibility', () => {
    it('plainToClass and plainToInstance should produce equivalent results', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { plainToClass, plainToInstance } = require('class-transformer')

      class TestClass {
        name: string
        value: number
      }

      const data = { name: 'test', value: 42 }
      const legacy = plainToClass(TestClass, data)
      const modern = plainToInstance(TestClass, data)

      expect(legacy).toEqual(modern)
      expect(legacy.name).toBe(modern.name)
      expect(legacy.value).toBe(modern.value)
    })

    it('classToPlain and instanceToPlain should produce equivalent results', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const {
        plainToInstance,
        classToPlain,
        instanceToPlain,
      } = require('class-transformer')

      class TestClass {
        name: string
        value: number
      }

      const data = { name: 'test', value: 42 }
      const instance = plainToInstance(TestClass, data)
      const legacy = classToPlain(instance)
      const modern = instanceToPlain(instance)

      expect(legacy).toEqual(modern)
    })

    it('should handle nested class transformation', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { plainToInstance, Type } = require('class-transformer')

      class NestedClass {
        id: number
      }

      class ParentClass {
        name: string
        @Type(() => NestedClass)
        nested: NestedClass
      }

      const data = {
        name: 'parent',
        nested: { id: 123 },
      }

      const instance = plainToInstance(ParentClass, data)
      expect(instance.name).toBe('parent')
      expect(instance.nested).toBeDefined()
      expect(instance.nested.id).toBe(123)
    })

    it('should handle array transformation', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { plainToInstance } = require('class-transformer')

      class ItemClass {
        id: number
        name: string
      }

      const dataArray = [
        { id: 1, name: 'item1' },
        { id: 2, name: 'item2' },
      ]

      const instances = plainToInstance(ItemClass, dataArray)
      expect(Array.isArray(instances)).toBe(true)
      expect(instances).toHaveLength(2)
      expect(instances[0].id).toBe(1)
      expect(instances[1].name).toBe('item2')
    })
  })

  describe('class-validator compatibility', () => {
    it('should validate objects correctly', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { validate, IsString, IsNumber, Min } = require('class-validator')
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { plainToInstance } = require('class-transformer')

      class ValidatedClass {
        @IsString()
        name: string

        @IsNumber()
        @Min(0)
        age: number
      }

      const validData = { name: 'John', age: 25 }
      const validInstance = plainToInstance(ValidatedClass, validData)
      const validErrors = await validate(validInstance)
      expect(validErrors).toHaveLength(0)

      const invalidData = { name: 123, age: -5 }
      const invalidInstance = plainToInstance(ValidatedClass, invalidData)
      const invalidErrors = await validate(invalidInstance)
      expect(invalidErrors.length).toBeGreaterThan(0)
    })

    it('should support validateSync', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { validateSync, IsNotEmpty } = require('class-validator')
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { plainToInstance } = require('class-transformer')

      class SyncValidatedClass {
        @IsNotEmpty()
        required: string
      }

      const emptyData = { required: '' }
      const instance = plainToInstance(SyncValidatedClass, emptyData)
      const errors = validateSync(instance)
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe('DynamoDB AttributeValue format', () => {
    it('should produce correct AttributeValue format for strings', () => {
      const marshalled = marshall({ name: 'test' })
      expect(marshalled.name).toEqual({ S: 'test' })
    })

    it('should produce correct AttributeValue format for numbers', () => {
      const marshalled = marshall({ count: 42 })
      expect(marshalled.count).toEqual({ N: '42' })
    })

    it('should produce correct AttributeValue format for booleans', () => {
      const marshalled = marshall({ active: true })
      expect(marshalled.active).toEqual({ BOOL: true })
    })

    it('should produce correct AttributeValue format for null', () => {
      const marshalled = marshall({ empty: null })
      expect(marshalled.empty).toEqual({ NULL: true })
    })

    it('should produce correct AttributeValue format for lists', () => {
      const marshalled = marshall({ items: [1, 2, 3] })
      expect(marshalled.items).toEqual({
        L: [{ N: '1' }, { N: '2' }, { N: '3' }],
      })
    })

    it('should produce correct AttributeValue format for maps', () => {
      const marshalled = marshall({ data: { key: 'value' } })
      expect(marshalled.data).toEqual({
        M: { key: { S: 'value' } },
      })
    })

    it('should produce correct AttributeValue format for string sets', () => {
      const marshalled = marshall({ tags: new Set(['a', 'b', 'c']) })
      expect(marshalled.tags).toEqual({
        SS: expect.arrayContaining(['a', 'b', 'c']),
      })
    })

    it('should produce correct AttributeValue format for number sets', () => {
      const marshalled = marshall({ numbers: new Set([1, 2, 3]) })
      expect(marshalled.numbers).toEqual({
        NS: expect.arrayContaining(['1', '2', '3']),
      })
    })
  })
})
