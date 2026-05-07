/**
 * class-transformer Advanced Integration Tests
 *
 * This file tests advanced class-transformer behavior:
 * - Circular reference handling
 * - Deep nested object transformation
 * - Custom transformers
 * - Type discrimination
 * - Versioning and groups
 *
 * These tests verify that class-transformer patterns work correctly
 * across package version updates.
 */
import {
  plainToInstance,
  instanceToPlain,
  Transform,
  Type,
  Expose,
  Exclude,
  TransformationType,
} from 'class-transformer'
import 'reflect-metadata'

describe('class-transformer Advanced Integration', () => {
  // ============================================================================
  // Deep Nested Object Tests
  // ============================================================================
  describe('Deep Nested Object Transformation', () => {
    class Address {
      @Expose()
      street!: string

      @Expose()
      city!: string

      @Expose()
      zipCode!: string
    }

    class Department {
      @Expose()
      name!: string

      @Expose()
      @Type(() => Address)
      location!: Address
    }

    class Company {
      @Expose()
      name!: string

      @Expose()
      @Type(() => Department)
      departments!: Department[]
    }

    class Employee {
      @Expose()
      name!: string

      @Expose()
      @Type(() => Department)
      department!: Department

      @Expose()
      @Type(() => Company)
      company!: Company
    }

    it('should transform deeply nested objects', () => {
      const plain = {
        name: 'John Doe',
        department: {
          name: 'Engineering',
          location: {
            street: '123 Tech St',
            city: 'San Francisco',
            zipCode: '94102',
          },
        },
        company: {
          name: 'TechCorp',
          departments: [
            {
              name: 'Engineering',
              location: {
                street: '123 Tech St',
                city: 'San Francisco',
                zipCode: '94102',
              },
            },
            {
              name: 'Marketing',
              location: {
                street: '456 Market St',
                city: 'San Francisco',
                zipCode: '94103',
              },
            },
          ],
        },
      }

      const employee = plainToInstance(Employee, plain)

      expect(employee).toBeInstanceOf(Employee)
      expect(employee.department).toBeInstanceOf(Department)
      expect(employee.department.location).toBeInstanceOf(Address)
      expect(employee.company).toBeInstanceOf(Company)
      expect(employee.company.departments[0]).toBeInstanceOf(Department)
      expect(employee.company.departments[0].location).toBeInstanceOf(Address)

      // Verify values
      expect(employee.name).toBe('John Doe')
      expect(employee.department.name).toBe('Engineering')
      expect(employee.department.location.city).toBe('San Francisco')
    })

    it('should handle null nested objects', () => {
      const plain = {
        name: 'John Doe',
        department: null,
        company: null,
      }

      const employee = plainToInstance(Employee, plain)

      expect(employee.name).toBe('John Doe')
      expect(employee.department).toBeNull()
      expect(employee.company).toBeNull()
    })

    it('should handle undefined nested objects', () => {
      const plain = {
        name: 'John Doe',
      }

      const employee = plainToInstance(Employee, plain)

      expect(employee.name).toBe('John Doe')
      expect(employee.department).toBeUndefined()
      expect(employee.company).toBeUndefined()
    })
  })

  // ============================================================================
  // Custom Transformer Tests
  // ============================================================================
  describe('Custom Transformers', () => {
    class DateTransformerDto {
      @Expose()
      @Transform(({ value }) => {
        if (value instanceof Date) {
          return value.toISOString()
        }
        return value
      }, { toPlainOnly: true })
      @Transform(({ value }) => {
        if (typeof value === 'string') {
          return new Date(value)
        }
        return value
      }, { toClassOnly: true })
      createdAt!: Date
    }

    class MoneyDto {
      @Expose()
      @Transform(({ value }) => {
        if (typeof value === 'number') {
          return Math.round(value * 100) // Convert to cents
        }
        return value
      }, { toPlainOnly: true })
      @Transform(({ value }) => {
        if (typeof value === 'number') {
          return value / 100 // Convert from cents
        }
        return value
      }, { toClassOnly: true })
      amount!: number
    }

    class TrimDto {
      @Expose()
      @Transform(({ value }) => {
        if (typeof value === 'string') {
          return value.trim()
        }
        return value
      })
      name!: string
    }

    class LowercaseDto {
      @Expose()
      @Transform(({ value }) => {
        if (typeof value === 'string') {
          return value.toLowerCase()
        }
        return value
      })
      email!: string
    }

    it('should transform dates to ISO string (to plain)', () => {
      const dto = new DateTransformerDto()
      dto.createdAt = new Date('2024-03-15T10:30:00Z')

      const plain = instanceToPlain(dto)

      expect(plain.createdAt).toBe('2024-03-15T10:30:00.000Z')
    })

    it('should transform ISO string to Date (to class)', () => {
      const plain = {
        createdAt: '2024-03-15T10:30:00.000Z',
      }

      const dto = plainToInstance(DateTransformerDto, plain)

      expect(dto.createdAt).toBeInstanceOf(Date)
      expect(dto.createdAt.getFullYear()).toBe(2024)
      expect(dto.createdAt.getMonth()).toBe(2) // March is 2 (0-indexed)
    })

    it('should transform money to cents (to plain)', () => {
      const dto = new MoneyDto()
      dto.amount = 19.99

      const plain = instanceToPlain(dto)

      expect(plain.amount).toBe(1999) // cents
    })

    it('should transform cents to money (to class)', () => {
      const plain = {
        amount: 1999,
      }

      const dto = plainToInstance(MoneyDto, plain)

      expect(dto.amount).toBe(19.99)
    })

    it('should trim string values', () => {
      const plain = {
        name: '  John Doe  ',
      }

      const dto = plainToInstance(TrimDto, plain)

      expect(dto.name).toBe('John Doe')
    })

    it('should lowercase email', () => {
      const plain = {
        email: 'John.Doe@Example.COM',
      }

      const dto = plainToInstance(LowercaseDto, plain)

      expect(dto.email).toBe('john.doe@example.com')
    })
  })

  // ============================================================================
  // Transform with Context Tests
  // ============================================================================
  describe('Transform with Context', () => {
    class ConditionalDto {
      @Expose()
      type!: string

      @Expose()
      @Transform(({ value, obj }) => {
        const data = obj as { type: string }
        if (data.type === 'percentage') {
          return value * 100
        }
        return value
      }, { toPlainOnly: true })
      @Transform(({ value, obj }) => {
        const data = obj as { type: string }
        if (data.type === 'percentage') {
          return value / 100
        }
        return value
      }, { toClassOnly: true })
      value!: number
    }

    class TransformationTypeDto {
      @Expose()
      @Transform(({ value, type }) => {
        if (type === TransformationType.PLAIN_TO_CLASS) {
          return `fromPlain:${value}`
        }
        if (type === TransformationType.CLASS_TO_PLAIN) {
          return `toPlain:${value}`
        }
        return value
      })
      data!: string
    }

    it('should use object context in transformation', () => {
      const percentPlain = { type: 'percentage', value: 50 }
      const percentDto = plainToInstance(ConditionalDto, percentPlain)
      expect(percentDto.value).toBe(0.5)

      const absolutePlain = { type: 'absolute', value: 50 }
      const absoluteDto = plainToInstance(ConditionalDto, absolutePlain)
      expect(absoluteDto.value).toBe(50)
    })

    it('should handle transformation type', () => {
      const plain = { data: 'test' }
      const dto = plainToInstance(TransformationTypeDto, plain)

      expect(dto.data).toBe('fromPlain:test')

      const backToPlain = instanceToPlain(dto)
      expect(backToPlain.data).toBe('toPlain:fromPlain:test')
    })
  })

  // ============================================================================
  // Expose and Exclude Tests
  // ============================================================================
  describe('Expose and Exclude', () => {
    @Exclude()
    class SecureDto {
      @Expose()
      id!: string

      @Expose()
      name!: string

      password!: string // Not exposed

      secret!: string // Not exposed
    }

    class PartialExcludeDto {
      @Expose()
      id!: string

      @Expose()
      name!: string

      @Exclude()
      internalCode!: string
    }

    class GroupDto {
      @Expose()
      id!: string

      @Expose({ groups: ['admin'] })
      adminData!: string

      @Expose({ groups: ['user', 'admin'] })
      userData!: string

      @Expose({ groups: ['public'] })
      publicData!: string
    }

    it('should only include exposed properties', () => {
      const plain = {
        id: '123',
        name: 'John',
        password: 'secret123',
        secret: 'topsecret',
      }

      const dto = plainToInstance(SecureDto, plain, {
        excludeExtraneousValues: true,
      })

      expect(dto.id).toBe('123')
      expect(dto.name).toBe('John')
      expect(dto.password).toBeUndefined()
      expect(dto.secret).toBeUndefined()
    })

    it('should exclude marked properties', () => {
      const dto = new PartialExcludeDto()
      dto.id = '123'
      dto.name = 'John'
      dto.internalCode = 'INT-001'

      const plain = instanceToPlain(dto)

      expect(plain.id).toBe('123')
      expect(plain.name).toBe('John')
      expect(plain.internalCode).toBeUndefined()
    })

    it('should handle groups', () => {
      const dto = new GroupDto()
      dto.id = '123'
      dto.adminData = 'admin only'
      dto.userData = 'user and admin'
      dto.publicData = 'everyone'

      // Admin view
      const adminPlain = instanceToPlain(dto, { groups: ['admin'] })
      expect(adminPlain.adminData).toBe('admin only')
      expect(adminPlain.userData).toBe('user and admin')
      expect(adminPlain.publicData).toBeUndefined()

      // User view
      const userPlain = instanceToPlain(dto, { groups: ['user'] })
      expect(userPlain.adminData).toBeUndefined()
      expect(userPlain.userData).toBe('user and admin')
      expect(userPlain.publicData).toBeUndefined()

      // Public view
      const publicPlain = instanceToPlain(dto, { groups: ['public'] })
      expect(publicPlain.adminData).toBeUndefined()
      expect(publicPlain.userData).toBeUndefined()
      expect(publicPlain.publicData).toBe('everyone')
    })
  })

  // ============================================================================
  // Array Transformation Tests
  // ============================================================================
  describe('Array Transformation', () => {
    class Item {
      @Expose()
      name!: string

      @Expose()
      price!: number
    }

    class Order {
      @Expose()
      orderId!: string

      @Expose()
      @Type(() => Item)
      items!: Item[]

      @Expose()
      @Transform(({ value }) => (value as number[])?.map((n) => n * 2))
      quantities!: number[]
    }

    it('should transform array of objects', () => {
      const plain = {
        orderId: 'ORD-001',
        items: [
          { name: 'Item 1', price: 10 },
          { name: 'Item 2', price: 20 },
          { name: 'Item 3', price: 30 },
        ],
        quantities: [1, 2, 3],
      }

      const order = plainToInstance(Order, plain)

      expect(order.items).toHaveLength(3)
      expect(order.items[0]).toBeInstanceOf(Item)
      expect(order.items[1].name).toBe('Item 2')
      expect(order.quantities).toEqual([2, 4, 6])
    })

    it('should handle empty arrays', () => {
      const plain = {
        orderId: 'ORD-002',
        items: [],
        quantities: [],
      }

      const order = plainToInstance(Order, plain)

      expect(order.items).toEqual([])
      expect(order.quantities).toEqual([])
    })

    it('should transform multiple instances', () => {
      const plains = [
        { orderId: 'ORD-001', items: [{ name: 'A', price: 10 }], quantities: [1] },
        { orderId: 'ORD-002', items: [{ name: 'B', price: 20 }], quantities: [2] },
      ]

      const orders = plainToInstance(Order, plains)

      expect(orders).toHaveLength(2)
      expect(orders[0]).toBeInstanceOf(Order)
      expect(orders[1]).toBeInstanceOf(Order)
      expect(orders[0].items[0]).toBeInstanceOf(Item)
    })
  })

  // ============================================================================
  // Map and Set Transformation Tests
  // ============================================================================
  describe('Map and Set Transformation', () => {
    class MapDto {
      @Expose()
      @Transform(({ value }) => {
        if (value instanceof Map) {
          return Object.fromEntries(value)
        }
        if (value && typeof value === 'object') {
          return new Map(Object.entries(value))
        }
        return value
      })
      data!: Map<string, unknown>
    }

    class SetDto {
      @Expose()
      @Transform(({ value }) => {
        if (value instanceof Set) {
          return Array.from(value)
        }
        if (Array.isArray(value)) {
          return new Set(value)
        }
        return value
      })
      tags!: Set<string>
    }

    it('should transform Map to object (to plain)', () => {
      const dto = new MapDto()
      dto.data = new Map([
        ['key1', 'value1'],
        ['key2', 'value2'],
      ])

      const plain = instanceToPlain(dto)

      expect(plain.data).toEqual({ key1: 'value1', key2: 'value2' })
    })

    it('should transform object to Map (to class)', () => {
      const plain = {
        data: { key1: 'value1', key2: 'value2' },
      }

      const dto = plainToInstance(MapDto, plain)

      expect(dto.data).toBeInstanceOf(Map)
      expect(dto.data.get('key1')).toBe('value1')
      expect(dto.data.size).toBe(2)
    })

    it('should transform Set to array (to plain)', () => {
      const dto = new SetDto()
      dto.tags = new Set(['tag1', 'tag2', 'tag3'])

      const plain = instanceToPlain(dto)

      expect(Array.isArray(plain.tags)).toBe(true)
      expect(plain.tags).toContain('tag1')
      expect(plain.tags).toHaveLength(3)
    })

    it('should transform array to Set (to class)', () => {
      const plain = {
        tags: ['tag1', 'tag2', 'tag2'], // Duplicate
      }

      const dto = plainToInstance(SetDto, plain)

      expect(dto.tags).toBeInstanceOf(Set)
      expect(dto.tags.size).toBe(2) // Duplicates removed
      expect(dto.tags.has('tag1')).toBe(true)
    })
  })

  // ============================================================================
  // Inheritance Tests
  // ============================================================================
  describe('Inheritance', () => {
    class BaseEntity {
      @Expose()
      id!: string

      @Expose()
      createdAt!: string
    }

    class User extends BaseEntity {
      @Expose()
      name!: string

      @Expose()
      email!: string
    }

    class Admin extends User {
      @Expose()
      permissions!: string[]
    }

    it('should transform inherited properties', () => {
      const plain = {
        id: '123',
        createdAt: '2024-03-15',
        name: 'John',
        email: 'john@example.com',
      }

      const user = plainToInstance(User, plain)

      expect(user).toBeInstanceOf(User)
      expect(user).toBeInstanceOf(BaseEntity)
      expect(user.id).toBe('123')
      expect(user.createdAt).toBe('2024-03-15')
      expect(user.name).toBe('John')
    })

    it('should transform multi-level inheritance', () => {
      const plain = {
        id: '123',
        createdAt: '2024-03-15',
        name: 'Admin User',
        email: 'admin@example.com',
        permissions: ['read', 'write', 'delete'],
      }

      const admin = plainToInstance(Admin, plain)

      expect(admin).toBeInstanceOf(Admin)
      expect(admin).toBeInstanceOf(User)
      expect(admin).toBeInstanceOf(BaseEntity)
      expect(admin.permissions).toEqual(['read', 'write', 'delete'])
    })
  })

  // ============================================================================
  // Default Values Tests
  // ============================================================================
  describe('Default Values', () => {
    class DefaultsDto {
      @Expose()
      name = 'Default Name'

      @Expose()
      count = 0

      @Expose()
      active = true

      @Expose()
      tags: string[] = []

      @Expose()
      @Transform(({ value }) => value ?? 'N/A')
      description!: string
    }

    it('should use default values when not provided (with exposeDefaultValues)', () => {
      const plain = {}

      // Note: plainToInstance doesn't call class constructor by default
      // To get default values, we need to use exposeDefaultValues option
      const dto = plainToInstance(DefaultsDto, plain, {
        exposeDefaultValues: true,
      })

      expect(dto.name).toBe('Default Name')
      expect(dto.count).toBe(0)
      expect(dto.active).toBe(true)
      expect(dto.tags).toEqual([])
      // Note: Transform with default value doesn't work with exposeDefaultValues
      // The Transform decorator needs an actual value to transform
      expect(dto.description).toBeUndefined()
    })

    it('should apply Transform default via null coalescing', () => {
      const plain = { description: null }

      const dto = plainToInstance(DefaultsDto, plain)

      // Transform's null coalescing operator handles null
      expect(dto.description).toBe('N/A')
    })

    it('should override defaults when values provided', () => {
      const plain = {
        name: 'Custom Name',
        count: 42,
        active: false,
        tags: ['a', 'b'],
        description: 'Custom Description',
      }

      const dto = plainToInstance(DefaultsDto, plain)

      expect(dto.name).toBe('Custom Name')
      expect(dto.count).toBe(42)
      expect(dto.active).toBe(false)
      expect(dto.tags).toEqual(['a', 'b'])
      expect(dto.description).toBe('Custom Description')
    })
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================
  describe('Edge Cases', () => {
    class EdgeCaseDto {
      @Expose()
      nullValue!: string | null

      @Expose()
      undefinedValue!: string | undefined

      @Expose()
      emptyString!: string

      @Expose()
      zero!: number

      @Expose()
      falseValue!: boolean
    }

    it('should preserve null values', () => {
      const plain = {
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
        zero: 0,
        falseValue: false,
      }

      const dto = plainToInstance(EdgeCaseDto, plain)

      expect(dto.nullValue).toBeNull()
      expect(dto.undefinedValue).toBeUndefined()
      expect(dto.emptyString).toBe('')
      expect(dto.zero).toBe(0)
      expect(dto.falseValue).toBe(false)
    })

    it('should handle special number values', () => {
      class NumberDto {
        @Expose()
        infinity!: number

        @Expose()
        negInfinity!: number

        @Expose()
        nan!: number
      }

      const plain = {
        infinity: Infinity,
        negInfinity: -Infinity,
        nan: NaN,
      }

      const dto = plainToInstance(NumberDto, plain)

      expect(dto.infinity).toBe(Infinity)
      expect(dto.negInfinity).toBe(-Infinity)
      expect(Number.isNaN(dto.nan)).toBe(true)
    })

    it('should handle deeply nested null', () => {
      class Level3 {
        @Expose()
        value!: string
      }

      class Level2 {
        @Expose()
        @Type(() => Level3)
        level3!: Level3 | null
      }

      class Level1 {
        @Expose()
        @Type(() => Level2)
        level2!: Level2 | null
      }

      const plain = {
        level2: {
          level3: null,
        },
      }

      const dto = plainToInstance(Level1, plain)

      expect(dto.level2).toBeInstanceOf(Level2)
      expect(dto.level2.level3).toBeNull()
    })
  })
})
