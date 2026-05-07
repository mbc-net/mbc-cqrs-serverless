/**
 * AWS SDK DynamoDB marshall/unmarshall Options Tests
 *
 * These tests verify that marshall/unmarshall options behave as expected.
 * When the AWS SDK changes option behavior, these tests will fail.
 */

import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'

describe('DynamoDB marshall/unmarshall Options Behavior', () => {
  describe('marshall options', () => {
    describe('removeUndefinedValues option', () => {
      it('should throw error when undefined values present without option', () => {
        const input = { defined: 'value', notDefined: undefined }

        // AWS SDK v3 throws error when undefined values are present
        // unless removeUndefinedValues option is set to true
        expect(() => marshall(input)).toThrow(
          /removeUndefinedValues=true/,
        )
      })

      it('should remove undefined values when option is true', () => {
        const input = { defined: 'value', notDefined: undefined }
        const result = marshall(input, { removeUndefinedValues: true })

        expect(result.defined).toEqual({ S: 'value' })
        expect(result.notDefined).toBeUndefined()
      })

      it('should remove nested undefined values', () => {
        const input = {
          outer: {
            defined: 'value',
            notDefined: undefined,
          },
        }
        const result = marshall(input, { removeUndefinedValues: true })
        const innerMap = result.outer as { M: Record<string, unknown> }

        expect(innerMap.M.defined).toEqual({ S: 'value' })
        expect(innerMap.M.notDefined).toBeUndefined()
      })
    })

    describe('convertEmptyValues option', () => {
      it('should handle empty string with convertEmptyValues false', () => {
        const input = { emptyString: '' }
        const result = marshall(input, { convertEmptyValues: false })

        // Empty string should be marshalled as-is
        expect(result.emptyString).toEqual({ S: '' })
      })

      it('should convert empty string to NULL with convertEmptyValues true', () => {
        const input = { emptyString: '' }
        const result = marshall(input, { convertEmptyValues: true })

        expect(result.emptyString).toEqual({ NULL: true })
      })

      it('should convert empty Set to NULL with convertEmptyValues true', () => {
        const input = { emptySet: new Set<string>() }
        const result = marshall(input, { convertEmptyValues: true })

        expect(result.emptySet).toEqual({ NULL: true })
      })

      it('should convert empty binary to NULL with convertEmptyValues true', () => {
        const input = { emptyBinary: new Uint8Array(0) }
        const result = marshall(input, { convertEmptyValues: true })

        expect(result.emptyBinary).toEqual({ NULL: true })
      })
    })

    describe('convertClassInstanceToMap option', () => {
      class CustomClass {
        name: string
        value: number

        constructor(name: string, value: number) {
          this.name = name
          this.value = value
        }

        getValue() {
          return this.value
        }
      }

      it('should throw error for class instance without option', () => {
        const input = { instance: new CustomClass('test', 42) }

        // Without convertClassInstanceToMap, class instances throw an error
        expect(() => marshall(input)).toThrow()
      })

      it('should convert class instance to map with option', () => {
        const input = { instance: new CustomClass('test', 42) }
        const result = marshall(input, { convertClassInstanceToMap: true })

        const instanceMap = result.instance as { M: Record<string, unknown> }
        expect(instanceMap.M).toBeDefined()
        expect(instanceMap.M.name).toEqual({ S: 'test' })
        expect(instanceMap.M.value).toEqual({ N: '42' })
        // Methods should not be included
        expect(instanceMap.M.getValue).toBeUndefined()
      })

      it('should handle nested class instances', () => {
        class Outer {
          inner: CustomClass
          constructor(inner: CustomClass) {
            this.inner = inner
          }
        }

        const input = { outer: new Outer(new CustomClass('nested', 100)) }
        const result = marshall(input, { convertClassInstanceToMap: true })

        const outerMap = result.outer as { M: Record<string, { M: Record<string, unknown> }> }
        expect(outerMap.M.inner.M.name).toEqual({ S: 'nested' })
      })
    })

    describe('convertTopLevelContainer option', () => {
      it('should wrap in Map by default for objects', () => {
        const input = { key: 'value' }
        const result = marshall(input)

        // Default behavior wraps at top level
        expect(result.key).toEqual({ S: 'value' })
      })
    })
  })

  describe('unmarshall options', () => {
    describe('wrapNumbers option', () => {
      it('should return plain numbers without wrapNumbers', () => {
        const input = { N: '123.45' }
        const result = unmarshall({ num: input })

        expect(result.num).toBe(123.45)
        expect(typeof result.num).toBe('number')
      })

      it('should wrap numbers when wrapNumbers is true', () => {
        const input = { N: '123.45' }
        const result = unmarshall({ num: input }, { wrapNumbers: true })

        // Wrapped numbers have a special structure
        expect(result.num).toBeDefined()
        expect(typeof result.num).toBe('object')
        expect((result.num as { value: string }).value).toBe('123.45')
      })

      it('should preserve precision for large numbers when wrapped', () => {
        // Number larger than MAX_SAFE_INTEGER
        const largeNum = '9007199254740993'
        const input = { N: largeNum }
        const result = unmarshall({ num: input }, { wrapNumbers: true })

        expect((result.num as { value: string }).value).toBe(largeNum)
      })
    })
  })

  describe('Round-trip with options', () => {
    it('should round-trip with removeUndefinedValues', () => {
      const original = {
        defined: 'value',
        number: 42,
        nested: {
          deep: 'nested-value',
        },
      }

      const marshalled = marshall(original, { removeUndefinedValues: true })
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled).toEqual(original)
    })

    it('should round-trip with convertClassInstanceToMap', () => {
      class TestClass {
        id: number
        name: string
        constructor(id: number, name: string) {
          this.id = id
          this.name = name
        }
      }

      const original = { item: new TestClass(1, 'test') }
      const marshalled = marshall(original, { convertClassInstanceToMap: true })
      const unmarshalled = unmarshall(marshalled)

      // Class instance becomes plain object after round-trip
      expect(unmarshalled.item).toEqual({ id: 1, name: 'test' })
    })
  })

  describe('DynamoDB AttributeValue types', () => {
    it('should correctly marshall and unmarshall String (S)', () => {
      const input = { str: 'hello' }
      const marshalled = marshall(input)
      const unmarshalled = unmarshall(marshalled)

      expect(marshalled.str).toEqual({ S: 'hello' })
      expect(unmarshalled.str).toBe('hello')
    })

    it('should correctly marshall and unmarshall Number (N)', () => {
      const input = { num: 42, float: 3.14 }
      const marshalled = marshall(input)
      const unmarshalled = unmarshall(marshalled)

      expect(marshalled.num).toEqual({ N: '42' })
      expect(marshalled.float).toEqual({ N: '3.14' })
      expect(unmarshalled.num).toBe(42)
      expect(unmarshalled.float).toBe(3.14)
    })

    it('should correctly marshall and unmarshall Boolean (BOOL)', () => {
      const input = { yes: true, no: false }
      const marshalled = marshall(input)
      const unmarshalled = unmarshall(marshalled)

      expect(marshalled.yes).toEqual({ BOOL: true })
      expect(marshalled.no).toEqual({ BOOL: false })
      expect(unmarshalled.yes).toBe(true)
      expect(unmarshalled.no).toBe(false)
    })

    it('should correctly marshall and unmarshall Null (NULL)', () => {
      const input = { empty: null }
      const marshalled = marshall(input)
      const unmarshalled = unmarshall(marshalled)

      expect(marshalled.empty).toEqual({ NULL: true })
      expect(unmarshalled.empty).toBeNull()
    })

    it('should correctly marshall and unmarshall List (L)', () => {
      const input = { list: [1, 'two', true, null] }
      const marshalled = marshall(input)
      const unmarshalled = unmarshall(marshalled)

      expect(marshalled.list).toEqual({
        L: [{ N: '1' }, { S: 'two' }, { BOOL: true }, { NULL: true }],
      })
      expect(unmarshalled.list).toEqual([1, 'two', true, null])
    })

    it('should correctly marshall and unmarshall Map (M)', () => {
      const input = {
        map: {
          nested: 'value',
          number: 123,
        },
      }
      const marshalled = marshall(input)
      const unmarshalled = unmarshall(marshalled)

      expect(marshalled.map).toEqual({
        M: {
          nested: { S: 'value' },
          number: { N: '123' },
        },
      })
      expect(unmarshalled.map).toEqual({ nested: 'value', number: 123 })
    })

    it('should correctly marshall and unmarshall String Set (SS)', () => {
      const input = { stringSet: new Set(['a', 'b', 'c']) }
      const marshalled = marshall(input)
      const unmarshalled = unmarshall(marshalled)

      expect(marshalled.stringSet).toEqual({
        SS: expect.arrayContaining(['a', 'b', 'c']),
      })
      expect(unmarshalled.stringSet).toBeInstanceOf(Set)
      expect(unmarshalled.stringSet).toEqual(new Set(['a', 'b', 'c']))
    })

    it('should correctly marshall and unmarshall Number Set (NS)', () => {
      const input = { numberSet: new Set([1, 2, 3]) }
      const marshalled = marshall(input)
      const unmarshalled = unmarshall(marshalled)

      expect(marshalled.numberSet).toEqual({
        NS: expect.arrayContaining(['1', '2', '3']),
      })
      expect(unmarshalled.numberSet).toBeInstanceOf(Set)
      expect(unmarshalled.numberSet).toEqual(new Set([1, 2, 3]))
    })

    it('should correctly marshall and unmarshall Binary (B)', () => {
      const binaryData = new Uint8Array([1, 2, 3, 4])
      const input = { binary: binaryData }
      const marshalled = marshall(input)
      const unmarshalled = unmarshall(marshalled)

      expect(marshalled.binary).toHaveProperty('B')
      expect(unmarshalled.binary).toBeInstanceOf(Uint8Array)
      expect(Array.from(unmarshalled.binary as Uint8Array)).toEqual([
        1, 2, 3, 4,
      ])
    })
  })

  describe('Edge cases in marshalling', () => {
    it('should handle deeply nested structures', () => {
      const input = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep',
              },
            },
          },
        },
      }
      const marshalled = marshall(input)
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled).toEqual(input)
    })

    it('should handle arrays with mixed types', () => {
      const input = {
        mixed: [
          'string',
          42,
          true,
          null,
          { nested: 'object' },
          ['nested', 'array'],
        ],
      }
      const marshalled = marshall(input)
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled).toEqual(input)
    })

    it('should handle special number values', () => {
      const input = {
        zero: 0,
        negative: -42,
        maxSafe: Number.MAX_SAFE_INTEGER,
        minSafe: Number.MIN_SAFE_INTEGER,
      }
      const marshalled = marshall(input)
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled.zero).toBe(0)
      expect(unmarshalled.negative).toBe(-42)
      expect(unmarshalled.maxSafe).toBe(Number.MAX_SAFE_INTEGER)
      expect(unmarshalled.minSafe).toBe(Number.MIN_SAFE_INTEGER)
    })

    it('should handle unicode strings', () => {
      const input = {
        japanese: '日本語',
        emoji: '🎉🚀💻',
        mixed: 'Hello 世界 🌍',
      }
      const marshalled = marshall(input)
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled).toEqual(input)
    })

    it('should handle empty containers', () => {
      const input = {
        emptyArray: [] as unknown[],
        emptyObject: {},
      }
      const marshalled = marshall(input)
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled.emptyArray).toEqual([])
      expect(unmarshalled.emptyObject).toEqual({})
    })
  })
})
