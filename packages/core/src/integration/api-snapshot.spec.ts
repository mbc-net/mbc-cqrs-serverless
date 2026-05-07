/**
 * API Snapshot Tests
 *
 * These tests use Jest snapshots to detect changes in API response structures,
 * data transformation outputs, and serialization formats. When a dependency
 * package changes its output format, these tests will fail and show the diff.
 */

import 'reflect-metadata'
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb'
import {
  plainToInstance,
  instanceToPlain,
  Transform,
  Expose,
  Exclude,
  Type,
} from 'class-transformer'
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsArray,
  IsNotEmpty,
  ValidateNested,
  validate,
  validateSync,
} from 'class-validator'
import { ulid } from 'ulid'

// Test DTOs for transformation snapshots
class AddressDto {
  @Expose()
  @IsString()
  street: string

  @Expose()
  @IsString()
  city: string

  @Expose()
  @IsString()
  @IsOptional()
  postalCode?: string
}

class UserDto {
  @Expose()
  @IsString()
  @IsNotEmpty()
  id: string

  @Expose()
  @IsString()
  @IsNotEmpty()
  name: string

  @Expose()
  @Transform(({ value }) => value?.toLowerCase())
  @IsString()
  email: string

  @Expose()
  @IsNumber()
  @IsOptional()
  age?: number

  @Expose()
  @IsBoolean()
  active: boolean

  @Expose()
  @IsEnum(['admin', 'user', 'guest'])
  role: string

  @Expose()
  @IsArray()
  @IsString({ each: true })
  tags: string[]

  @Expose()
  @ValidateNested()
  @Type(() => AddressDto)
  @IsOptional()
  address?: AddressDto

  @Exclude()
  password?: string

  @Expose()
  @Type(() => Date)
  createdAt: Date
}

describe('API Snapshot Tests', () => {
  describe('DynamoDB marshall/unmarshall snapshots', () => {
    it('should marshall simple object consistently', () => {
      const input = {
        pk: 'USER#123',
        sk: 'PROFILE#456',
        name: 'John Doe',
        age: 30,
        active: true,
        score: 95.5,
      }

      const result = marshall(input)
      expect(result).toMatchSnapshot()
    })

    it('should marshall complex nested object consistently', () => {
      const input = {
        pk: 'ORDER#789',
        sk: 'ITEM#001',
        items: [
          { id: 'item1', name: 'Product A', quantity: 2, price: 19.99 },
          { id: 'item2', name: 'Product B', quantity: 1, price: 29.99 },
        ],
        metadata: {
          source: 'web',
          campaign: 'summer-sale',
          tags: ['electronics', 'sale'],
        },
        timestamps: {
          created: '2024-01-01T00:00:00Z',
          updated: '2024-01-02T00:00:00Z',
        },
      }

      const result = marshall(input)
      expect(result).toMatchSnapshot()
    })

    it('should marshall with special types consistently', () => {
      const input = {
        pk: 'DATA#001',
        nullValue: null,
        emptyString: '',
        emptyArray: [],
        emptyObject: {},
        binaryData: Buffer.from('hello'),
        setOfStrings: new Set(['a', 'b', 'c']),
        setOfNumbers: new Set([1, 2, 3]),
      }

      const result = marshall(input, {
        removeUndefinedValues: true,
        convertEmptyValues: true,
        convertClassInstanceToMap: true,
      })
      expect(result).toMatchSnapshot()
    })

    it('should unmarshall DynamoDB response consistently', () => {
      const dynamoItem = {
        pk: { S: 'USER#123' },
        sk: { S: 'PROFILE#456' },
        name: { S: 'John Doe' },
        age: { N: '30' },
        active: { BOOL: true },
        tags: { L: [{ S: 'developer' }, { S: 'nodejs' }] },
        address: {
          M: {
            street: { S: '123 Main St' },
            city: { S: 'Tokyo' },
          },
        },
        scores: { NS: ['95', '87', '92'] },
        flags: { SS: ['verified', 'premium'] },
      }

      const result = unmarshall(dynamoItem)
      expect(result).toMatchSnapshot()
    })

    it('should handle NULL and BOOL types consistently', () => {
      const dynamoItem = {
        isNull: { NULL: true },
        isTrue: { BOOL: true },
        isFalse: { BOOL: false },
      }

      const result = unmarshall(dynamoItem)
      expect(result).toMatchSnapshot()
    })
  })

  describe('class-transformer snapshots', () => {
    it('should transform plain to instance consistently', () => {
      const plain = {
        id: 'user-123',
        name: 'Jane Doe',
        email: 'JANE@EXAMPLE.COM',
        age: 25,
        active: true,
        role: 'admin',
        tags: ['developer', 'lead'],
        address: {
          street: '456 Oak Ave',
          city: 'Osaka',
          postalCode: '530-0001',
        },
        password: 'secret123',
        createdAt: '2024-01-15T10:30:00Z',
      }

      const instance = plainToInstance(UserDto, plain)

      // Check instance type
      expect(instance).toBeInstanceOf(UserDto)

      // Snapshot the plain representation
      const output = instanceToPlain(instance, { excludeExtraneousValues: true })
      expect(output).toMatchSnapshot()
    })

    it('should handle missing optional fields consistently', () => {
      const plain = {
        id: 'user-456',
        name: 'Bob Smith',
        email: 'BOB@EXAMPLE.COM',
        active: false,
        role: 'user',
        tags: [],
        createdAt: '2024-02-01T08:00:00Z',
      }

      const instance = plainToInstance(UserDto, plain)
      const output = instanceToPlain(instance, { excludeExtraneousValues: true })
      expect(output).toMatchSnapshot()
    })

    it('should transform with groups consistently', () => {
      class SecureUserDto {
        @Expose({ groups: ['public', 'admin'] })
        id: string

        @Expose({ groups: ['public', 'admin'] })
        name: string

        @Expose({ groups: ['admin'] })
        email: string

        @Expose({ groups: ['admin'] })
        role: string
      }

      const instance = new SecureUserDto()
      instance.id = 'user-789'
      instance.name = 'Alice'
      instance.email = 'alice@example.com'
      instance.role = 'admin'

      const publicOutput = instanceToPlain(instance, { groups: ['public'] })
      const adminOutput = instanceToPlain(instance, { groups: ['admin'] })

      expect(publicOutput).toMatchSnapshot('public-group')
      expect(adminOutput).toMatchSnapshot('admin-group')
    })

    it('should handle array transformation consistently', () => {
      class ItemDto {
        @Expose()
        id: string

        @Expose()
        name: string
      }

      class ContainerDto {
        @Expose()
        @Type(() => ItemDto)
        items: ItemDto[]
      }

      const plain = {
        items: [
          { id: '1', name: 'Item 1' },
          { id: '2', name: 'Item 2' },
          { id: '3', name: 'Item 3' },
        ],
      }

      const instance = plainToInstance(ContainerDto, plain)
      const output = instanceToPlain(instance, { excludeExtraneousValues: true })
      expect(output).toMatchSnapshot()
    })
  })

  describe('class-validator error structure snapshots', () => {
    it('should produce consistent validation error structure', async () => {
      const invalidUser = new UserDto()
      invalidUser.id = '' // Invalid: empty
      invalidUser.name = '' // Invalid: empty
      invalidUser.email = 'not-an-email'
      invalidUser.active = true
      invalidUser.role = 'invalid-role' // Invalid: not in enum
      invalidUser.tags = []

      const errors = await validate(invalidUser)

      // Normalize errors for snapshot (remove target which contains object reference)
      const normalizedErrors = errors.map((error) => ({
        property: error.property,
        constraints: error.constraints,
        value: error.value,
      }))

      expect(normalizedErrors).toMatchSnapshot()
    })

    it('should produce consistent nested validation error structure', async () => {
      const userWithInvalidAddress = new UserDto()
      userWithInvalidAddress.id = 'user-123'
      userWithInvalidAddress.name = 'Test User'
      userWithInvalidAddress.email = 'test@example.com'
      userWithInvalidAddress.active = true
      userWithInvalidAddress.role = 'user'
      userWithInvalidAddress.tags = ['test']

      const invalidAddress = new AddressDto()
      invalidAddress.street = '' // Invalid: empty string - but IsString passes
      invalidAddress.city = '' // Invalid: empty string - but IsString passes
      userWithInvalidAddress.address = invalidAddress

      const errors = await validate(userWithInvalidAddress)

      const normalizedErrors = errors.map((error) => ({
        property: error.property,
        constraints: error.constraints,
        children: error.children?.map((child) => ({
          property: child.property,
          constraints: child.constraints,
        })),
      }))

      expect(normalizedErrors).toMatchSnapshot()
    })

    it('should produce consistent validateSync error structure', () => {
      class StrictDto {
        @IsString()
        @IsNotEmpty()
        required: string

        @IsNumber()
        number: number
      }

      const invalid = new StrictDto()
      invalid.required = ''
      invalid.number = NaN

      const errors = validateSync(invalid)

      const normalizedErrors = errors.map((error) => ({
        property: error.property,
        constraints: error.constraints,
      }))

      expect(normalizedErrors).toMatchSnapshot()
    })
  })

  describe('ULID format snapshots', () => {
    it('should produce consistent ULID format', () => {
      // Use fixed timestamp for reproducible snapshot
      const fixedTime = 1704067200000 // 2024-01-01 00:00:00 UTC

      const id = ulid(fixedTime)

      // Verify format characteristics (not exact value due to random component)
      expect(id.length).toBe(26)
      expect(/^[0-9A-HJKMNP-TV-Z]{26}$/.test(id)).toBe(true)

      // Extract and verify timestamp portion (first 10 characters)
      const timestampPortion = id.substring(0, 10)
      expect(timestampPortion.length).toBe(10)

      // Snapshot the structure characteristics
      expect({
        length: id.length,
        matchesPattern: /^[0-9A-HJKMNP-TV-Z]{26}$/.test(id),
        timestampLength: timestampPortion.length,
      }).toMatchSnapshot()
    })
  })

  describe('Complex data structure snapshots', () => {
    it('should handle CQRS command structure consistently', () => {
      const command = {
        pk: 'TENANT#tenant1#ORDER',
        sk: 'ORDER#2024-001',
        version: 1,
        code: '2024-001',
        type: 'ORDER',
        attributes: {
          customerId: 'cust-123',
          items: [
            { productId: 'prod-1', quantity: 2, price: 100 },
            { productId: 'prod-2', quantity: 1, price: 200 },
          ],
          total: 400,
          status: 'pending',
        },
        createdAt: '2024-01-15T10:00:00Z',
        createdBy: 'user-001',
        updatedAt: '2024-01-15T10:00:00Z',
        updatedBy: 'user-001',
      }

      const marshalled = marshall(command)
      expect(marshalled).toMatchSnapshot()
    })

    it('should handle event sourcing structure consistently', () => {
      const events = [
        {
          eventId: 'evt-001',
          aggregateId: 'order-2024-001',
          eventType: 'OrderCreated',
          version: 1,
          timestamp: '2024-01-15T10:00:00Z',
          payload: { customerId: 'cust-123', items: [] },
        },
        {
          eventId: 'evt-002',
          aggregateId: 'order-2024-001',
          eventType: 'ItemAdded',
          version: 2,
          timestamp: '2024-01-15T10:01:00Z',
          payload: { productId: 'prod-1', quantity: 2 },
        },
        {
          eventId: 'evt-003',
          aggregateId: 'order-2024-001',
          eventType: 'OrderSubmitted',
          version: 3,
          timestamp: '2024-01-15T10:02:00Z',
          payload: { submittedBy: 'user-001' },
        },
      ]

      const marshalledEvents = events.map((e) => marshall(e))
      expect(marshalledEvents).toMatchSnapshot()
    })
  })

  describe('Edge case snapshots', () => {
    it('should handle unicode strings consistently', () => {
      const unicodeData = {
        japanese: '日本語テスト',
        chinese: '中文测试',
        korean: '한국어 테스트',
        emoji: '🎉🚀💻',
        mixed: 'Hello 世界 🌍',
      }

      const marshalled = marshall(unicodeData)
      const unmarshalled = unmarshall(marshalled)

      expect(unmarshalled).toMatchSnapshot()
    })

    it('should handle special number values consistently', () => {
      const numberData = {
        integer: 42,
        negative: -100,
        float: 3.14159,
        scientific: 1.23e10,
        zero: 0,
        largeNumber: Number.MAX_SAFE_INTEGER,
        smallNumber: Number.MIN_SAFE_INTEGER,
      }

      const marshalled = marshall(numberData)
      expect(marshalled).toMatchSnapshot()
    })

    it('should handle deeply nested structures consistently', () => {
      const deeplyNested = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: 'deep',
                  array: [1, 2, { nested: true }],
                },
              },
            },
          },
        },
      }

      const marshalled = marshall(deeplyNested)
      expect(marshalled).toMatchSnapshot()
    })
  })
})
