/**
 * Complex Type Compatibility Tests
 *
 * This file tests complex type handling:
 * - Map/Set marshalling and unmarshalling
 * - BigInt support
 * - ArrayBuffer and TypedArray
 * - Symbol key handling
 * - Circular reference detection
 *
 * These tests verify type handling contracts to detect breaking changes.
 */
import 'reflect-metadata'

import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import {
  Expose,
  instanceToPlain,
  plainToInstance,
  Transform,
  Type,
} from 'class-transformer'
import {
  IsNumber,
  IsString,
  validate,
  ValidateNested,
} from 'class-validator'

describe('Complex Type Compatibility Tests', () => {
  // ============================================================================
  // Map Type Handling
  // ============================================================================
  describe('Map type handling', () => {
    describe('DynamoDB Map marshalling', () => {
      it('should marshall Map with string keys', () => {
        const map = new Map<string, string>([
          ['key1', 'value1'],
          ['key2', 'value2'],
        ])

        // Convert Map to object for marshalling
        const mapAsObject = Object.fromEntries(map)
        const marshalled = marshall({ data: mapAsObject })

        expect(marshalled.data.M).toBeDefined()
        expect(marshalled.data.M.key1).toEqual({ S: 'value1' })
        expect(marshalled.data.M.key2).toEqual({ S: 'value2' })
      })

      it('should unmarshall to object (Map needs manual conversion)', () => {
        const dynamoItem = {
          data: {
            M: {
              key1: { S: 'value1' },
              key2: { S: 'value2' },
            },
          },
        }

        const unmarshalled = unmarshall(dynamoItem)

        // DynamoDB returns object, not Map
        expect(typeof unmarshalled.data).toBe('object')
        expect(unmarshalled.data.key1).toBe('value1')
        expect(unmarshalled.data.key2).toBe('value2')

        // Convert to Map if needed
        const asMap = new Map(Object.entries(unmarshalled.data))
        expect(asMap.get('key1')).toBe('value1')
      })

      it('should handle nested Maps', () => {
        const nestedMap = {
          level1: {
            level2: {
              value: 'deep',
            },
          },
        }

        const marshalled = marshall({ data: nestedMap })
        const unmarshalled = unmarshall(marshalled)

        expect(unmarshalled.data.level1.level2.value).toBe('deep')
      })
    })

    describe('class-transformer Map handling', () => {
      class MapContainer {
        @Transform(({ value }) => new Map(Object.entries(value || {})), {
          toClassOnly: true,
        })
        @Transform(({ value }) => Object.fromEntries(value || new Map()), {
          toPlainOnly: true,
        })
        data: Map<string, string>
      }

      it('should transform plain object to Map', () => {
        const plain = { data: { key1: 'value1', key2: 'value2' } }
        const instance = plainToInstance(MapContainer, plain)

        expect(instance.data).toBeInstanceOf(Map)
        expect(instance.data.get('key1')).toBe('value1')
        expect(instance.data.get('key2')).toBe('value2')
      })

      it('should transform Map to plain object', () => {
        const instance = new MapContainer()
        instance.data = new Map([
          ['key1', 'value1'],
          ['key2', 'value2'],
        ])

        const plain = instanceToPlain(instance)

        expect(plain.data).toEqual({ key1: 'value1', key2: 'value2' })
      })
    })
  })

  // ============================================================================
  // Set Type Handling
  // ============================================================================
  describe('Set type handling', () => {
    describe('DynamoDB Set marshalling', () => {
      it('should marshall string Set to SS', () => {
        const set = new Set(['a', 'b', 'c'])
        const marshalled = marshall({ tags: set })

        expect(marshalled.tags.SS).toBeDefined()
        expect(marshalled.tags.SS).toContain('a')
        expect(marshalled.tags.SS).toContain('b')
        expect(marshalled.tags.SS).toContain('c')
      })

      it('should marshall number Set to NS', () => {
        const set = new Set([1, 2, 3])
        const marshalled = marshall({ numbers: set })

        expect(marshalled.numbers.NS).toBeDefined()
        expect(marshalled.numbers.NS).toContain('1')
        expect(marshalled.numbers.NS).toContain('2')
        expect(marshalled.numbers.NS).toContain('3')
      })

      it('should unmarshall SS back to Set', () => {
        const dynamoItem = {
          tags: { SS: ['a', 'b', 'c'] },
        }

        const unmarshalled = unmarshall(dynamoItem)

        expect(unmarshalled.tags).toBeInstanceOf(Set)
        expect(unmarshalled.tags.has('a')).toBe(true)
        expect(unmarshalled.tags.has('b')).toBe(true)
        expect(unmarshalled.tags.has('c')).toBe(true)
      })

      it('should unmarshall NS back to Set of numbers', () => {
        const dynamoItem = {
          numbers: { NS: ['1', '2', '3'] },
        }

        const unmarshalled = unmarshall(dynamoItem)

        expect(unmarshalled.numbers).toBeInstanceOf(Set)
        expect(unmarshalled.numbers.has(1)).toBe(true)
        expect(unmarshalled.numbers.has(2)).toBe(true)
        expect(unmarshalled.numbers.has(3)).toBe(true)
      })

      it('should handle empty Set with convertEmptyValues', () => {
        const emptySet = new Set<string>()
        const marshalled = marshall(
          { tags: emptySet },
          { convertEmptyValues: true },
        )

        expect(marshalled.tags.NULL).toBe(true)
      })
    })

    describe('class-transformer Set handling', () => {
      class SetContainer {
        @Transform(({ value }) => new Set(value || []), { toClassOnly: true })
        @Transform(({ value }) => Array.from(value || new Set()), {
          toPlainOnly: true,
        })
        items: Set<string>
      }

      it('should transform array to Set', () => {
        const plain = { items: ['a', 'b', 'c'] }
        const instance = plainToInstance(SetContainer, plain)

        expect(instance.items).toBeInstanceOf(Set)
        expect(instance.items.has('a')).toBe(true)
      })

      it('should transform Set to array', () => {
        const instance = new SetContainer()
        instance.items = new Set(['x', 'y', 'z'])

        const plain = instanceToPlain(instance)

        expect(Array.isArray(plain.items)).toBe(true)
        expect(plain.items).toContain('x')
      })
    })
  })

  // ============================================================================
  // BigInt Support
  // ============================================================================
  describe('BigInt support', () => {
    describe('DynamoDB BigInt handling', () => {
      it('should marshall BigInt as string number', () => {
        const bigValue = BigInt('9007199254740993')
        const marshalled = marshall({ bigNum: bigValue })

        expect(marshalled.bigNum.N).toBe('9007199254740993')
      })

      it('should preserve precision for large numbers with wrapNumbers', () => {
        const dynamoItem = {
          bigNum: { N: '9007199254740993' },
        }

        const unmarshalled = unmarshall(dynamoItem, { wrapNumbers: true })

        // wrapNumbers returns an object with value property
        expect(typeof unmarshalled.bigNum).toBe('object')
        expect(unmarshalled.bigNum.value).toBe('9007199254740993')

        // Convert to BigInt
        const asBigInt = BigInt(unmarshalled.bigNum.value)
        expect(asBigInt.toString()).toBe('9007199254740993')
      })

      it('should lose precision without wrapNumbers for numbers > MAX_SAFE_INTEGER', () => {
        const dynamoItem = {
          bigNum: { N: '9007199254740993' },
        }

        const unmarshalled = unmarshall(dynamoItem)

        // Without wrapNumbers, JavaScript number precision is lost
        // 9007199254740993 becomes 9007199254740992 due to floating point
        expect(unmarshalled.bigNum).not.toBe(9007199254740993)
      })

      it('should handle negative BigInt', () => {
        const negBigInt = BigInt('-9007199254740993')
        const marshalled = marshall({ bigNum: negBigInt })

        expect(marshalled.bigNum.N).toBe('-9007199254740993')
      })
    })

    describe('BigInt JSON serialization', () => {
      it('should require custom serializer for BigInt in JSON', () => {
        const obj = { value: BigInt(123) }

        // JSON.stringify throws on BigInt by default
        expect(() => JSON.stringify(obj)).toThrow()
      })

      it('should serialize BigInt with custom replacer', () => {
        const obj = { value: BigInt('9007199254740993') }

        const json = JSON.stringify(obj, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value,
        )

        expect(json).toBe('{"value":"9007199254740993"}')
      })

      it('should deserialize string to BigInt with reviver', () => {
        const json = '{"value":"9007199254740993","type":"bigint"}'

        const obj = JSON.parse(json, (key, value) => {
          if (key === 'value' && typeof value === 'string') {
            return BigInt(value)
          }
          return value
        })

        expect(typeof obj.value).toBe('bigint')
        expect(obj.value.toString()).toBe('9007199254740993')
      })
    })
  })

  // ============================================================================
  // ArrayBuffer and TypedArray
  // ============================================================================
  describe('ArrayBuffer and TypedArray', () => {
    describe('DynamoDB binary handling', () => {
      it('should marshall Uint8Array as binary', () => {
        const binary = new Uint8Array([1, 2, 3, 4, 5])
        const marshalled = marshall({ data: binary })

        expect(marshalled.data.B).toBeDefined()
      })

      it('should unmarshall binary to Uint8Array', () => {
        const dynamoItem = {
          data: { B: new Uint8Array([1, 2, 3, 4, 5]) },
        }

        const unmarshalled = unmarshall(dynamoItem)

        expect(unmarshalled.data).toBeInstanceOf(Uint8Array)
        expect(Array.from(unmarshalled.data)).toEqual([1, 2, 3, 4, 5])
      })

      it('should handle binary Set (BS)', () => {
        const binarySet = [
          new Uint8Array([1, 2]),
          new Uint8Array([3, 4]),
        ]

        // DynamoDB binary sets need special handling
        const dynamoItem = {
          binaries: {
            BS: binarySet,
          },
        }

        const unmarshalled = unmarshall(dynamoItem)
        expect(unmarshalled.binaries).toBeInstanceOf(Set)
      })
    })

    describe('Buffer operations', () => {
      it('should convert Buffer to Uint8Array', () => {
        const buffer = Buffer.from('hello world')
        const uint8 = new Uint8Array(buffer)

        expect(uint8).toBeInstanceOf(Uint8Array)
        expect(Buffer.from(uint8).toString()).toBe('hello world')
      })

      it('should handle Buffer in DynamoDB', () => {
        const buffer = Buffer.from('test data')
        const marshalled = marshall({ data: buffer })

        expect(marshalled.data.B).toBeDefined()
      })

      it('should round-trip binary data', () => {
        const original = new Uint8Array([0, 1, 127, 128, 255])
        const marshalled = marshall({ binary: original })
        const unmarshalled = unmarshall(marshalled)

        expect(Array.from(unmarshalled.binary)).toEqual([0, 1, 127, 128, 255])
      })
    })
  })

  // ============================================================================
  // Symbol Key Handling
  // ============================================================================
  describe('Symbol key handling', () => {
    describe('Symbol keys in objects', () => {
      it('should not marshall Symbol keys', () => {
        const sym = Symbol('test')
        const obj = {
          [sym]: 'symbol-value',
          normalKey: 'normal-value',
        } as Record<string | symbol, string>

        const marshalled = marshall(obj as Record<string, unknown>)

        // Symbol keys are not included in marshalling
        expect(marshalled.normalKey).toBeDefined()
        expect(Object.keys(marshalled)).not.toContain(sym.toString())
      })

      it('should not include Symbol in JSON serialization', () => {
        const sym = Symbol('test')
        const obj = {
          [sym]: 'symbol-value',
          normalKey: 'normal-value',
        }

        const json = JSON.stringify(obj)
        const parsed = JSON.parse(json)

        expect(parsed.normalKey).toBe('normal-value')
        expect(Object.keys(parsed)).toHaveLength(1)
      })
    })

    describe('Well-known Symbols', () => {
      it('should handle objects with Symbol.iterator', () => {
        const iterableObj = {
          data: [1, 2, 3],
          *[Symbol.iterator]() {
            yield* this.data
          },
        }

        // Can iterate
        expect([...iterableObj]).toEqual([1, 2, 3])

        // But Symbol.iterator is not serialized
        const plain = { ...iterableObj }
        expect(typeof plain[Symbol.iterator]).toBe('function')
      })

      it('should handle objects with Symbol.toStringTag', () => {
        const obj = {
          get [Symbol.toStringTag]() {
            return 'CustomObject'
          },
          value: 42,
        }

        expect(Object.prototype.toString.call(obj)).toBe('[object CustomObject]')

        // Symbol.toStringTag is not marshalled
        const marshalled = marshall({ data: obj }, { convertClassInstanceToMap: true })
        expect(marshalled.data.M.value).toEqual({ N: '42' })
      })
    })
  })

  // ============================================================================
  // Circular Reference Detection
  // ============================================================================
  describe('Circular reference detection', () => {
    describe('Direct circular references', () => {
      it('should detect self-reference in marshall', () => {
        const obj: Record<string, unknown> = { name: 'test' }
        obj.self = obj

        expect(() => marshall(obj)).toThrow()
      })

      it('should detect circular reference in JSON.stringify', () => {
        const obj: Record<string, unknown> = { name: 'test' }
        obj.self = obj

        expect(() => JSON.stringify(obj)).toThrow()
      })
    })

    describe('Indirect circular references', () => {
      it('should detect indirect circular reference', () => {
        const a: Record<string, unknown> = { name: 'a' }
        const b: Record<string, unknown> = { name: 'b' }
        a.ref = b
        b.ref = a

        expect(() => marshall(a)).toThrow()
      })

      it('should detect deep circular reference', () => {
        const root: Record<string, unknown> = { level: 0 }
        const child: Record<string, unknown> = { level: 1, parent: root }
        const grandchild: Record<string, unknown> = { level: 2, ancestor: root }
        root.child = child
        child.child = grandchild

        expect(() => marshall(root)).toThrow()
      })
    })

    describe('class-transformer circular handling', () => {
      class Node {
        name: string

        @Type(() => Node)
        children: Node[]

        @Type(() => Node)
        parent?: Node
      }

      it('should handle circular with enableCircularCheck', () => {
        const parent = new Node()
        parent.name = 'parent'

        const child = new Node()
        child.name = 'child'
        child.parent = parent

        parent.children = [child]

        // enableCircularCheck prevents infinite loop
        expect(() => {
          instanceToPlain(parent, { enableCircularCheck: true })
        }).not.toThrow()
      })
    })
  })

  // ============================================================================
  // Complex Nested Type Handling
  // ============================================================================
  describe('Complex nested type handling', () => {
    describe('Deeply nested structures', () => {
      it('should handle deeply nested objects', () => {
        const deep = {
          l1: {
            l2: {
              l3: {
                l4: {
                  l5: {
                    value: 'deep-value',
                  },
                },
              },
            },
          },
        }

        const marshalled = marshall(deep)
        const unmarshalled = unmarshall(marshalled)

        expect(unmarshalled.l1.l2.l3.l4.l5.value).toBe('deep-value')
      })

      it('should handle mixed arrays and objects', () => {
        const mixed = {
          items: [
            { type: 'a', values: [1, 2, 3] },
            { type: 'b', values: [4, 5, 6] },
          ],
          metadata: {
            tags: ['tag1', 'tag2'],
            config: {
              enabled: true,
              count: 42,
            },
          },
        }

        const marshalled = marshall(mixed)
        const unmarshalled = unmarshall(marshalled)

        expect(unmarshalled).toEqual(mixed)
      })
    })

    describe('class-validator with complex types', () => {
      class Address {
        @IsString()
        street: string

        @IsString()
        city: string
      }

      class Person {
        @IsString()
        name: string

        @ValidateNested()
        @Type(() => Address)
        address: Address

        @ValidateNested({ each: true })
        @Type(() => Address)
        previousAddresses: Address[]
      }

      it('should validate nested objects', async () => {
        const person = plainToInstance(Person, {
          name: 'John',
          address: { street: '123 Main', city: 'NYC' },
          previousAddresses: [
            { street: '456 Oak', city: 'LA' },
            { street: '789 Pine', city: 'SF' },
          ],
        })

        const errors = await validate(person)
        expect(errors).toHaveLength(0)
      })

      it('should catch nested validation errors', async () => {
        const person = plainToInstance(Person, {
          name: 'John',
          address: { street: 123, city: 'NYC' }, // street should be string
          previousAddresses: [],
        })

        const errors = await validate(person)
        expect(errors.length).toBeGreaterThan(0)

        // Find nested error
        const addressError = errors.find((e) => e.property === 'address')
        expect(addressError?.children?.length).toBeGreaterThan(0)
      })

      it('should catch array item validation errors', async () => {
        const person = plainToInstance(Person, {
          name: 'John',
          address: { street: 'Main', city: 'NYC' },
          previousAddresses: [
            { street: 123, city: 456 }, // Both should be strings
          ],
        })

        const errors = await validate(person)
        const arrayError = errors.find(
          (e) => e.property === 'previousAddresses',
        )
        expect(arrayError?.children?.length).toBeGreaterThan(0)
      })
    })
  })

  // ============================================================================
  // Special Value Handling
  // ============================================================================
  describe('Special value handling', () => {
    describe('null and undefined', () => {
      it('should marshall null as NULL', () => {
        const marshalled = marshall({ value: null })
        expect(marshalled.value).toEqual({ NULL: true })
      })

      it('should require removeUndefinedValues for undefined', () => {
        expect(() => marshall({ value: undefined })).toThrow()
      })

      it('should remove undefined with option', () => {
        const marshalled = marshall(
          { defined: 'value', notDefined: undefined },
          { removeUndefinedValues: true },
        )

        expect(marshalled.defined).toBeDefined()
        expect(marshalled.notDefined).toBeUndefined()
      })
    })

    describe('Special number values', () => {
      it('should handle zero', () => {
        const marshalled = marshall({ value: 0 })
        expect(marshalled.value).toEqual({ N: '0' })
      })

      it('should handle negative zero', () => {
        const marshalled = marshall({ value: -0 })
        // -0 becomes 0 in string representation
        expect(marshalled.value).toEqual({ N: '0' })
      })

      it('should handle very small decimals', () => {
        const marshalled = marshall({ value: 0.0000001 })
        const unmarshalled = unmarshall(marshalled)
        expect(unmarshalled.value).toBeCloseTo(0.0000001)
      })

      it('should handle MAX_SAFE_INTEGER', () => {
        const marshalled = marshall({ value: Number.MAX_SAFE_INTEGER })
        const unmarshalled = unmarshall(marshalled)
        expect(unmarshalled.value).toBe(Number.MAX_SAFE_INTEGER)
      })

      it('should handle MIN_SAFE_INTEGER', () => {
        const marshalled = marshall({ value: Number.MIN_SAFE_INTEGER })
        const unmarshalled = unmarshall(marshalled)
        expect(unmarshalled.value).toBe(Number.MIN_SAFE_INTEGER)
      })
    })

    describe('Empty containers', () => {
      it('should handle empty array', () => {
        const marshalled = marshall({ arr: [] })
        const unmarshalled = unmarshall(marshalled)
        expect(unmarshalled.arr).toEqual([])
      })

      it('should handle empty object', () => {
        const marshalled = marshall({ obj: {} })
        const unmarshalled = unmarshall(marshalled)
        expect(unmarshalled.obj).toEqual({})
      })

      it('should handle empty string', () => {
        const marshalled = marshall({ str: '' })
        expect(marshalled.str).toEqual({ S: '' })
      })
    })
  })
})
