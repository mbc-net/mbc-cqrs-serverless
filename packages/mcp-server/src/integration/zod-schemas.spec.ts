/**
 * Third-party Integration Tests: zod
 *
 * This test suite validates the zod package's input/output behavior
 * to ensure compatibility with the MBC CQRS Serverless framework.
 *
 * Package: zod (^3.23.0)
 * Purpose: TypeScript-first schema validation with static type inference
 *
 * Test coverage:
 * - z.string() validation
 * - z.number() validation (min, max, int)
 * - z.object() nested objects
 * - z.array() array validation
 * - z.enum() enumeration types
 * - z.optional() optional fields
 * - z.default() default values
 * - z.union() union types
 * - z.transform() value transformation
 * - z.refine() custom validation
 * - parse() vs safeParse() behavior
 * - Error message customization
 * - Breaking change detection for major version upgrades
 */

import { z, ZodError } from 'zod'

describe('zod Integration Tests', () => {
  describe('z.string() Validation', () => {
    it('should validate basic string', () => {
      // Input: Schema definition
      const schema = z.string()

      // Input: Value to validate
      // Output: Validated value (same as input for strings)
      expect(schema.parse('hello')).toBe('hello')
      expect(schema.parse('')).toBe('')
    })

    it('should reject non-string values', () => {
      const schema = z.string()

      expect(() => schema.parse(123)).toThrow(ZodError)
      expect(() => schema.parse(null)).toThrow(ZodError)
      expect(() => schema.parse(undefined)).toThrow(ZodError)
      expect(() => schema.parse({})).toThrow(ZodError)
    })

    it('should validate string with min length', () => {
      const schema = z.string().min(3)

      expect(schema.parse('abc')).toBe('abc')
      expect(schema.parse('abcd')).toBe('abcd')
      expect(() => schema.parse('ab')).toThrow(ZodError)
    })

    it('should validate string with max length', () => {
      const schema = z.string().max(5)

      expect(schema.parse('abc')).toBe('abc')
      expect(schema.parse('abcde')).toBe('abcde')
      expect(() => schema.parse('abcdef')).toThrow(ZodError)
    })

    it('should validate email format', () => {
      const schema = z.string().email()

      expect(schema.parse('test@example.com')).toBe('test@example.com')
      expect(() => schema.parse('invalid-email')).toThrow(ZodError)
      expect(() => schema.parse('test@')).toThrow(ZodError)
    })

    it('should validate URL format', () => {
      const schema = z.string().url()

      expect(schema.parse('https://example.com')).toBe('https://example.com')
      expect(schema.parse('http://localhost:3000')).toBe(
        'http://localhost:3000',
      )
      expect(() => schema.parse('not-a-url')).toThrow(ZodError)
    })

    it('should validate UUID format', () => {
      const schema = z.string().uuid()

      expect(schema.parse('550e8400-e29b-41d4-a716-446655440000')).toBe(
        '550e8400-e29b-41d4-a716-446655440000',
      )
      expect(() => schema.parse('not-a-uuid')).toThrow(ZodError)
    })

    it('should validate with regex pattern', () => {
      const schema = z.string().regex(/^[A-Z]{3}\d{4}$/)

      expect(schema.parse('ABC1234')).toBe('ABC1234')
      expect(() => schema.parse('abc1234')).toThrow(ZodError)
      expect(() => schema.parse('ABCD1234')).toThrow(ZodError)
    })

    it('should trim whitespace', () => {
      const schema = z.string().trim()

      expect(schema.parse('  hello  ')).toBe('hello')
      expect(schema.parse('\t\nhello\n\t')).toBe('hello')
    })

    it('should transform to lowercase', () => {
      const schema = z.string().toLowerCase()

      expect(schema.parse('HELLO')).toBe('hello')
      expect(schema.parse('HeLLo WoRLd')).toBe('hello world')
    })

    it('should transform to uppercase', () => {
      const schema = z.string().toUpperCase()

      expect(schema.parse('hello')).toBe('HELLO')
    })
  })

  describe('z.number() Validation', () => {
    it('should validate basic number', () => {
      const schema = z.number()

      expect(schema.parse(42)).toBe(42)
      expect(schema.parse(3.14)).toBe(3.14)
      expect(schema.parse(-10)).toBe(-10)
      expect(schema.parse(0)).toBe(0)
    })

    it('should reject non-number values', () => {
      const schema = z.number()

      expect(() => schema.parse('42')).toThrow(ZodError)
      expect(() => schema.parse(null)).toThrow(ZodError)
      expect(() => schema.parse(NaN)).toThrow(ZodError)
    })

    it('should validate number with min value', () => {
      const schema = z.number().min(10)

      expect(schema.parse(10)).toBe(10)
      expect(schema.parse(100)).toBe(100)
      expect(() => schema.parse(9)).toThrow(ZodError)
    })

    it('should validate number with max value', () => {
      const schema = z.number().max(100)

      expect(schema.parse(100)).toBe(100)
      expect(schema.parse(0)).toBe(0)
      expect(() => schema.parse(101)).toThrow(ZodError)
    })

    it('should validate integer', () => {
      const schema = z.number().int()

      expect(schema.parse(42)).toBe(42)
      expect(schema.parse(-10)).toBe(-10)
      expect(() => schema.parse(3.14)).toThrow(ZodError)
    })

    it('should validate positive number', () => {
      const schema = z.number().positive()

      expect(schema.parse(1)).toBe(1)
      expect(() => schema.parse(0)).toThrow(ZodError)
      expect(() => schema.parse(-1)).toThrow(ZodError)
    })

    it('should validate non-negative number', () => {
      const schema = z.number().nonnegative()

      expect(schema.parse(0)).toBe(0)
      expect(schema.parse(100)).toBe(100)
      expect(() => schema.parse(-1)).toThrow(ZodError)
    })

    it('should validate negative number', () => {
      const schema = z.number().negative()

      expect(schema.parse(-1)).toBe(-1)
      expect(() => schema.parse(0)).toThrow(ZodError)
      expect(() => schema.parse(1)).toThrow(ZodError)
    })

    it('should validate finite number', () => {
      const schema = z.number().finite()

      expect(schema.parse(42)).toBe(42)
      expect(() => schema.parse(Infinity)).toThrow(ZodError)
      expect(() => schema.parse(-Infinity)).toThrow(ZodError)
    })

    it('should validate multipleOf', () => {
      const schema = z.number().multipleOf(5)

      expect(schema.parse(10)).toBe(10)
      expect(schema.parse(0)).toBe(0)
      expect(() => schema.parse(7)).toThrow(ZodError)
    })
  })

  describe('z.object() Nested Objects', () => {
    it('should validate simple object', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      })

      const input = { name: 'John', age: 30 }
      const result = schema.parse(input)

      expect(result).toEqual({ name: 'John', age: 30 })
    })

    it('should strip unknown keys by default', () => {
      const schema = z.object({
        name: z.string(),
      })

      const input = { name: 'John', extra: 'ignored' }
      const result = schema.parse(input)

      expect(result).toEqual({ name: 'John' })
      expect(result).not.toHaveProperty('extra')
    })

    it('should keep unknown keys with passthrough', () => {
      const schema = z
        .object({
          name: z.string(),
        })
        .passthrough()

      const input = { name: 'John', extra: 'kept' }
      const result = schema.parse(input)

      expect(result).toEqual({ name: 'John', extra: 'kept' })
    })

    it('should reject unknown keys with strict', () => {
      const schema = z
        .object({
          name: z.string(),
        })
        .strict()

      const input = { name: 'John', extra: 'should fail' }

      expect(() => schema.parse(input)).toThrow(ZodError)
    })

    it('should validate nested objects', () => {
      const addressSchema = z.object({
        street: z.string(),
        city: z.string(),
        zip: z.string(),
      })

      const personSchema = z.object({
        name: z.string(),
        address: addressSchema,
      })

      const input = {
        name: 'John',
        address: {
          street: '123 Main St',
          city: 'New York',
          zip: '10001',
        },
      }

      const result = personSchema.parse(input)

      expect(result.name).toBe('John')
      expect(result.address.city).toBe('New York')
    })

    it('should validate deeply nested objects', () => {
      const schema = z.object({
        level1: z.object({
          level2: z.object({
            level3: z.object({
              value: z.string(),
            }),
          }),
        }),
      })

      const input = {
        level1: {
          level2: {
            level3: {
              value: 'deep',
            },
          },
        },
      }

      const result = schema.parse(input)
      expect(result.level1.level2.level3.value).toBe('deep')
    })

    it('should merge objects with extend', () => {
      const baseSchema = z.object({
        id: z.string(),
        createdAt: z.date(),
      })

      const userSchema = baseSchema.extend({
        name: z.string(),
        email: z.string().email(),
      })

      const input = {
        id: '123',
        createdAt: new Date(),
        name: 'John',
        email: 'john@example.com',
      }

      const result = userSchema.parse(input)

      expect(result.id).toBe('123')
      expect(result.name).toBe('John')
    })

    it('should pick specific fields', () => {
      const schema = z.object({
        name: z.string(),
        email: z.string(),
        password: z.string(),
      })

      const publicSchema = schema.pick({ name: true, email: true })

      const input = { name: 'John', email: 'john@example.com' }
      const result = publicSchema.parse(input)

      expect(result).toEqual({ name: 'John', email: 'john@example.com' })
    })

    it('should omit specific fields', () => {
      const schema = z.object({
        name: z.string(),
        email: z.string(),
        password: z.string(),
      })

      const safeSchema = schema.omit({ password: true })

      const input = { name: 'John', email: 'john@example.com' }
      const result = safeSchema.parse(input)

      expect(result).toEqual({ name: 'John', email: 'john@example.com' })
    })

    it('should make all fields partial', () => {
      const schema = z.object({
        name: z.string(),
        email: z.string(),
      })

      const partialSchema = schema.partial()

      expect(partialSchema.parse({})).toEqual({})
      expect(partialSchema.parse({ name: 'John' })).toEqual({ name: 'John' })
    })
  })

  describe('z.array() Array Validation', () => {
    it('should validate array of strings', () => {
      const schema = z.array(z.string())

      expect(schema.parse(['a', 'b', 'c'])).toEqual(['a', 'b', 'c'])
      expect(schema.parse([])).toEqual([])
    })

    it('should reject non-array values', () => {
      const schema = z.array(z.string())

      expect(() => schema.parse('not an array')).toThrow(ZodError)
      expect(() => schema.parse({ 0: 'a', 1: 'b' })).toThrow(ZodError)
    })

    it('should validate array element types', () => {
      const schema = z.array(z.number())

      expect(schema.parse([1, 2, 3])).toEqual([1, 2, 3])
      expect(() => schema.parse([1, 'two', 3])).toThrow(ZodError)
    })

    it('should validate array with min length', () => {
      const schema = z.array(z.string()).min(2)

      expect(schema.parse(['a', 'b'])).toEqual(['a', 'b'])
      expect(() => schema.parse(['a'])).toThrow(ZodError)
    })

    it('should validate array with max length', () => {
      const schema = z.array(z.string()).max(3)

      expect(schema.parse(['a', 'b', 'c'])).toEqual(['a', 'b', 'c'])
      expect(() => schema.parse(['a', 'b', 'c', 'd'])).toThrow(ZodError)
    })

    it('should validate array with exact length', () => {
      const schema = z.array(z.string()).length(3)

      expect(schema.parse(['a', 'b', 'c'])).toEqual(['a', 'b', 'c'])
      expect(() => schema.parse(['a', 'b'])).toThrow(ZodError)
      expect(() => schema.parse(['a', 'b', 'c', 'd'])).toThrow(ZodError)
    })

    it('should validate non-empty array', () => {
      const schema = z.array(z.string()).nonempty()

      expect(schema.parse(['a'])).toEqual(['a'])
      expect(() => schema.parse([])).toThrow(ZodError)
    })

    it('should validate array of objects', () => {
      const schema = z.array(
        z.object({
          id: z.number(),
          name: z.string(),
        }),
      )

      const input = [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
      ]

      expect(schema.parse(input)).toEqual(input)
    })
  })

  describe('z.enum() Enumeration Types', () => {
    it('should validate enum values', () => {
      const schema = z.enum(['admin', 'user', 'guest'])

      expect(schema.parse('admin')).toBe('admin')
      expect(schema.parse('user')).toBe('user')
      expect(schema.parse('guest')).toBe('guest')
    })

    it('should reject invalid enum values', () => {
      const schema = z.enum(['admin', 'user', 'guest'])

      expect(() => schema.parse('superuser')).toThrow(ZodError)
      expect(() => schema.parse('ADMIN')).toThrow(ZodError)
    })

    it('should provide enum options', () => {
      const schema = z.enum(['admin', 'user', 'guest'])

      expect(schema.options).toEqual(['admin', 'user', 'guest'])
    })

    it('should work with native enum', () => {
      enum Role {
        Admin = 'admin',
        User = 'user',
        Guest = 'guest',
      }

      const schema = z.nativeEnum(Role)

      expect(schema.parse(Role.Admin)).toBe('admin')
      expect(schema.parse('user')).toBe('user')
      expect(() => schema.parse('invalid')).toThrow(ZodError)
    })

    it('should work with numeric enum', () => {
      enum Status {
        Pending = 0,
        Active = 1,
        Completed = 2,
      }

      const schema = z.nativeEnum(Status)

      expect(schema.parse(Status.Active)).toBe(1)
      expect(schema.parse(0)).toBe(0)
      expect(() => schema.parse(5)).toThrow(ZodError)
    })
  })

  describe('z.optional() Optional Fields', () => {
    it('should allow undefined for optional fields', () => {
      const schema = z.object({
        name: z.string(),
        nickname: z.string().optional(),
      })

      expect(schema.parse({ name: 'John' })).toEqual({ name: 'John' })
      expect(schema.parse({ name: 'John', nickname: undefined })).toEqual({
        name: 'John',
      })
      expect(schema.parse({ name: 'John', nickname: 'Johnny' })).toEqual({
        name: 'John',
        nickname: 'Johnny',
      })
    })

    it('should reject null for optional fields (use nullable instead)', () => {
      const schema = z.string().optional()

      expect(schema.parse(undefined)).toBeUndefined()
      expect(() => schema.parse(null)).toThrow(ZodError)
    })

    it('should allow null with nullable', () => {
      const schema = z.string().nullable()

      expect(schema.parse(null)).toBeNull()
      expect(schema.parse('hello')).toBe('hello')
      expect(() => schema.parse(undefined)).toThrow(ZodError)
    })

    it('should allow both null and undefined with nullish', () => {
      const schema = z.string().nullish()

      expect(schema.parse(null)).toBeNull()
      expect(schema.parse(undefined)).toBeUndefined()
      expect(schema.parse('hello')).toBe('hello')
    })
  })

  describe('z.default() Default Values', () => {
    it('should provide default for undefined', () => {
      const schema = z.string().default('default_value')

      expect(schema.parse(undefined)).toBe('default_value')
      expect(schema.parse('custom')).toBe('custom')
    })

    it('should not use default for null', () => {
      const schema = z.string().nullable().default('default_value')

      expect(schema.parse(null)).toBeNull()
      expect(schema.parse(undefined)).toBe('default_value')
    })

    it('should work with objects', () => {
      const schema = z.object({
        name: z.string(),
        role: z.enum(['admin', 'user']).default('user'),
        active: z.boolean().default(true),
      })

      expect(schema.parse({ name: 'John' })).toEqual({
        name: 'John',
        role: 'user',
        active: true,
      })
    })

    it('should call default function for each parse', () => {
      let counter = 0
      const schema = z.number().default(() => ++counter)

      expect(schema.parse(undefined)).toBe(1)
      expect(schema.parse(undefined)).toBe(2)
      expect(schema.parse(100)).toBe(100)
    })
  })

  describe('z.union() Union Types', () => {
    it('should validate union of primitives', () => {
      const schema = z.union([z.string(), z.number()])

      expect(schema.parse('hello')).toBe('hello')
      expect(schema.parse(42)).toBe(42)
      expect(() => schema.parse(true)).toThrow(ZodError)
    })

    it('should validate discriminated union', () => {
      const schema = z.discriminatedUnion('type', [
        z.object({ type: z.literal('user'), name: z.string() }),
        z.object({
          type: z.literal('admin'),
          name: z.string(),
          level: z.number(),
        }),
      ])

      expect(schema.parse({ type: 'user', name: 'John' })).toEqual({
        type: 'user',
        name: 'John',
      })
      expect(schema.parse({ type: 'admin', name: 'Admin', level: 5 })).toEqual({
        type: 'admin',
        name: 'Admin',
        level: 5,
      })
      expect(() => schema.parse({ type: 'guest', name: 'Guest' })).toThrow(
        ZodError,
      )
    })

    it('should work with or() shorthand', () => {
      const schema = z.string().or(z.number())

      expect(schema.parse('hello')).toBe('hello')
      expect(schema.parse(42)).toBe(42)
    })
  })

  describe('z.transform() Value Transformation', () => {
    it('should transform string to number', () => {
      const schema = z.string().transform((val) => parseInt(val, 10))

      // Input: string
      // Output: number (transformed)
      const result = schema.parse('42')

      expect(result).toBe(42)
      expect(typeof result).toBe('number')
    })

    it('should transform and validate in sequence', () => {
      const schema = z
        .string()
        .transform((val) => val.trim())
        .pipe(z.string().min(1))

      expect(schema.parse('  hello  ')).toBe('hello')
      expect(() => schema.parse('   ')).toThrow(ZodError)
    })

    it('should transform object properties', () => {
      const schema = z
        .object({
          first: z.string(),
          last: z.string(),
        })
        .transform((val) => ({
          fullName: `${val.first} ${val.last}`,
        }))

      expect(schema.parse({ first: 'John', last: 'Doe' })).toEqual({
        fullName: 'John Doe',
      })
    })

    it('should chain multiple transforms', () => {
      const schema = z
        .string()
        .transform((val) => val.toLowerCase())
        .transform((val) => val.trim())
        .transform((val) => val.replace(/\s+/g, '_'))

      expect(schema.parse('  Hello World  ')).toBe('hello_world')
    })

    it('should coerce values', () => {
      const numberSchema = z.coerce.number()
      const stringSchema = z.coerce.string()
      const booleanSchema = z.coerce.boolean()

      expect(numberSchema.parse('42')).toBe(42)
      expect(stringSchema.parse(42)).toBe('42')
      expect(booleanSchema.parse(1)).toBe(true)
      expect(booleanSchema.parse(0)).toBe(false)
    })
  })

  describe('z.refine() Custom Validation', () => {
    it('should apply custom validation', () => {
      const schema = z.string().refine((val) => val.includes('@'), {
        message: 'Must contain @',
      })

      expect(schema.parse('test@example.com')).toBe('test@example.com')
      expect(() => schema.parse('invalid')).toThrow(ZodError)
    })

    it('should use refinement for complex validation', () => {
      const passwordSchema = z
        .string()
        .min(8)
        .refine((val) => /[A-Z]/.test(val), {
          message: 'Must contain uppercase letter',
        })
        .refine((val) => /[a-z]/.test(val), {
          message: 'Must contain lowercase letter',
        })
        .refine((val) => /[0-9]/.test(val), {
          message: 'Must contain number',
        })

      expect(passwordSchema.parse('Password123')).toBe('Password123')
      expect(() => passwordSchema.parse('password123')).toThrow(ZodError)
    })

    it('should validate with superRefine for multiple errors', () => {
      const schema = z
        .object({
          password: z.string(),
          confirmPassword: z.string(),
        })
        .superRefine((data, ctx) => {
          if (data.password !== data.confirmPassword) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Passwords do not match',
              path: ['confirmPassword'],
            })
          }
        })

      expect(
        schema.parse({ password: 'secret', confirmPassword: 'secret' }),
      ).toEqual({ password: 'secret', confirmPassword: 'secret' })
      expect(() =>
        schema.parse({ password: 'secret', confirmPassword: 'different' }),
      ).toThrow(ZodError)
    })
  })

  describe('parse() vs safeParse() Behavior', () => {
    it('should throw ZodError on parse() failure', () => {
      const schema = z.string()

      expect(() => schema.parse(123)).toThrow(ZodError)

      try {
        schema.parse(123)
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError)
        expect((error as ZodError).issues).toHaveLength(1)
      }
    })

    it('should return result object on safeParse()', () => {
      const schema = z.string()

      // Successful parse
      const successResult = schema.safeParse('hello')
      expect(successResult.success).toBe(true)
      if (successResult.success) {
        expect(successResult.data).toBe('hello')
      }

      // Failed parse
      const failResult = schema.safeParse(123)
      expect(failResult.success).toBe(false)
      if (!failResult.success) {
        expect(failResult.error).toBeInstanceOf(ZodError)
      }
    })

    it('should provide detailed error information', () => {
      const schema = z.object({
        name: z.string().min(1),
        age: z.number().positive(),
        email: z.string().email(),
      })

      const result = schema.safeParse({
        name: '',
        age: -5,
        email: 'invalid',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThanOrEqual(3)

        const paths = result.error.issues.map((issue) => issue.path[0])
        expect(paths).toContain('name')
        expect(paths).toContain('age')
        expect(paths).toContain('email')
      }
    })
  })

  describe('Error Message Customization', () => {
    it('should use custom error message', () => {
      const schema = z.string({
        required_error: 'Name is required',
        invalid_type_error: 'Name must be a string',
      })

      try {
        schema.parse(undefined)
      } catch (error) {
        expect((error as ZodError).issues[0].message).toBe('Name is required')
      }

      try {
        schema.parse(123)
      } catch (error) {
        expect((error as ZodError).issues[0].message).toBe(
          'Name must be a string',
        )
      }
    })

    it('should use custom message in refinements', () => {
      const schema = z.string().min(5, { message: 'Must be at least 5 chars' })

      try {
        schema.parse('abc')
      } catch (error) {
        expect((error as ZodError).issues[0].message).toBe(
          'Must be at least 5 chars',
        )
      }
    })

    it('should format errors with flatten()', () => {
      const schema = z.object({
        name: z.string().min(1, 'Name required'),
        email: z.string().email('Invalid email'),
      })

      const result = schema.safeParse({ name: '', email: 'bad' })

      if (!result.success) {
        const flattened = result.error.flatten()

        expect(flattened.fieldErrors).toHaveProperty('name')
        expect(flattened.fieldErrors).toHaveProperty('email')
        expect(flattened.fieldErrors.name).toContain('Name required')
        expect(flattened.fieldErrors.email).toContain('Invalid email')
      }
    })
  })

  describe('Type Inference', () => {
    it('should infer types correctly', () => {
      const userSchema = z.object({
        id: z.number(),
        name: z.string(),
        email: z.string().email(),
        role: z.enum(['admin', 'user']),
        metadata: z.record(z.string()).optional(),
      })

      // Type inference
      type User = z.infer<typeof userSchema>

      const user: User = {
        id: 1,
        name: 'John',
        email: 'john@example.com',
        role: 'admin',
        metadata: { key: 'value' },
      }

      expect(userSchema.parse(user)).toEqual(user)
    })

    it('should infer input vs output types for transforms', () => {
      const schema = z.object({
        dateStr: z.string().transform((s) => new Date(s)),
      })

      // Input type has string
      type Input = z.input<typeof schema>
      // Output type has Date
      type Output = z.infer<typeof schema>

      const input: Input = { dateStr: '2024-01-01' }
      const output: Output = schema.parse(input)

      expect(output.dateStr).toBeInstanceOf(Date)
    })
  })

  describe('Usage Patterns in MBC MCP Server', () => {
    /**
     * This test demonstrates patterns used in MCP Server tools
     */
    it('should match generate module schema pattern', () => {
      const GenerateModuleSchema = z.object({
        name: z.string().describe('Name of the module to generate'),
        mode: z
          .enum(['async', 'sync'])
          .optional()
          .describe('Command processing mode'),
      })

      const validInput = { name: 'order', mode: 'async' }
      const result = GenerateModuleSchema.parse(validInput)

      expect(result.name).toBe('order')
      expect(result.mode).toBe('async')
    })

    it('should work with Tool inputSchema pattern', () => {
      // Pattern for generating JSON Schema from Zod
      const schema = z.object({
        name: z.string(),
        options: z
          .object({
            enabled: z.boolean().default(true),
            count: z.number().int().positive().optional(),
          })
          .optional(),
      })

      const input = {
        name: 'test',
        options: { enabled: false },
      }

      const result = schema.parse(input)

      expect(result.name).toBe('test')
      expect(result.options?.enabled).toBe(false)
    })

    it('should validate API request parameters', () => {
      const requestSchema = z.object({
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
        path: z.string().startsWith('/'),
        body: z.record(z.unknown()).optional(),
        headers: z.record(z.string()).optional(),
      })

      const request = {
        method: 'POST',
        path: '/api/users',
        body: { name: 'John' },
        headers: { 'Content-Type': 'application/json' },
      }

      expect(requestSchema.parse(request)).toEqual(request)
    })
  })

  describe('Advanced Patterns', () => {
    it('should validate recursive types', () => {
      interface Category {
        name: string
        subcategories?: Category[]
      }

      // Use type assertion for recursive schema
      const categorySchema: z.ZodType<Category> = z.lazy(() =>
        z.object({
          name: z.string(),
          subcategories: z.array(categorySchema).optional(),
        }),
      ) as z.ZodType<Category>

      const category = {
        name: 'Electronics',
        subcategories: [
          {
            name: 'Phones',
            subcategories: [{ name: 'Smartphones' }],
          },
        ],
      }

      expect(categorySchema.parse(category)).toEqual(category)
    })

    it('should validate record types', () => {
      const schema = z.record(z.string(), z.number())

      expect(schema.parse({ a: 1, b: 2 })).toEqual({ a: 1, b: 2 })
      expect(() => schema.parse({ a: 'not a number' })).toThrow(ZodError)
    })

    it('should validate tuple types', () => {
      const schema = z.tuple([z.string(), z.number(), z.boolean()])

      expect(schema.parse(['hello', 42, true])).toEqual(['hello', 42, true])
      expect(() => schema.parse(['hello', 42])).toThrow(ZodError)
      expect(() => schema.parse(['hello', 'not number', true])).toThrow(
        ZodError,
      )
    })

    it('should use preprocess for input normalization', () => {
      const schema = z.preprocess(
        (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
        z.string().min(1),
      )

      expect(schema.parse('  HELLO  ')).toBe('hello')
      expect(() => schema.parse('   ')).toThrow(ZodError)
    })
  })

  describe('Breaking Change Detection', () => {
    /**
     * These tests verify behaviors that are known to change between
     * major zod versions. If any of these tests fail after a zod upgrade,
     * it indicates a breaking change that may require code updates.
     *
     * Key breaking changes in zod v4:
     * - z.record() requires 2 arguments (key, value)
     * - Error params: required_error/invalid_type_error replaced with error
     * - z.string().email/url/uuid() deprecated in favor of z.email/url/uuid()
     * - Default + optional behavior change: defaults apply even in optional
     * - .refine()/.min()/.max() message param replaced with error param
     */

    describe('z.record() single-argument form', () => {
      it('should accept single argument z.record(valueSchema)', () => {
        // v3: z.record(z.string()) means Record<string, string>
        // v4: requires 2 arguments z.record(z.string(), z.string())
        const schema = z.record(z.string())

        expect(schema.parse({ a: 'hello', b: 'world' })).toEqual({
          a: 'hello',
          b: 'world',
        })
        expect(() => schema.parse({ a: 123 })).toThrow(ZodError)
      })

      it('should accept single argument z.record(z.unknown())', () => {
        const schema = z.record(z.unknown())

        expect(schema.parse({ a: 1, b: 'two', c: true })).toEqual({
          a: 1,
          b: 'two',
          c: true,
        })
      })
    })

    describe('Error customization params', () => {
      it('should support required_error param', () => {
        // v3: z.string({ required_error: '...' })
        // v4: replaced with z.string({ error: (issue) => ... })
        const schema = z.string({
          required_error: 'Field is required',
          invalid_type_error: 'Must be a string',
        })

        const result1 = schema.safeParse(undefined)
        expect(result1.success).toBe(false)
        if (!result1.success) {
          expect(result1.error.issues[0].message).toBe('Field is required')
        }

        const result2 = schema.safeParse(123)
        expect(result2.success).toBe(false)
        if (!result2.success) {
          expect(result2.error.issues[0].message).toBe('Must be a string')
        }
      })

      it('should support message param in .min()', () => {
        // v3: .min(5, { message: '...' })
        // v4: replaced with .min(5, { error: '...' })
        const schema = z.string().min(5, { message: 'Too short' })

        const result = schema.safeParse('abc')
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Too short')
        }
      })

      it('should support message param in .max()', () => {
        const schema = z.string().max(3, { message: 'Too long' })

        const result = schema.safeParse('abcde')
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Too long')
        }
      })

      it('should support message param in .refine()', () => {
        // v3: .refine(fn, { message: '...' })
        // v4: replaced with .refine(fn, { error: '...' })
        const schema = z.string().refine((val) => val.startsWith('MBC'), {
          message: 'Must start with MBC',
        })

        const result = schema.safeParse('hello')
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Must start with MBC')
        }
      })

      it('should support string message shorthand in .email()', () => {
        // v3: .email('Custom message') or .email({ message: '...' })
        // v4: .email({ error: '...' })
        const schema = z.string().email('Invalid email format')

        const result = schema.safeParse('bad')
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('Invalid email format')
        }
      })
    })

    describe('Optional + default interaction', () => {
      it('should not apply default when field is optional and missing', () => {
        // v3: defaults are NOT applied to optional fields when missing
        // v4: defaults ARE applied even within optional fields
        const schema = z.object({
          name: z.string().default('anonymous').optional(),
        })

        const result = schema.parse({})
        // v3 behavior: {} (default not applied because field is optional)
        // v4 behavior: { name: 'anonymous' } (default is applied)
        expect(result).toEqual({})
      })
    })

    describe('z.string() format method chaining', () => {
      it('should support .email() as method on z.string()', () => {
        // v3: z.string().email() is the standard way
        // v4: z.email() is preferred, z.string().email() deprecated but still works
        const schema = z.string().email()

        expect(schema.parse('test@example.com')).toBe('test@example.com')
        expect(() => schema.parse('bad')).toThrow(ZodError)
      })

      it('should support .url() as method on z.string()', () => {
        const schema = z.string().url()

        expect(schema.parse('https://example.com')).toBe('https://example.com')
        expect(() => schema.parse('bad')).toThrow(ZodError)
      })

      it('should support .uuid() as method on z.string()', () => {
        const schema = z.string().uuid()

        expect(schema.parse('550e8400-e29b-41d4-a716-446655440000')).toBe(
          '550e8400-e29b-41d4-a716-446655440000',
        )
        expect(() => schema.parse('bad')).toThrow(ZodError)
      })
    })

    describe('ZodError structure', () => {
      it('should expose issues array on ZodError', () => {
        const schema = z.string()

        try {
          schema.parse(123)
          fail('Expected ZodError')
        } catch (error) {
          expect(error).toBeInstanceOf(ZodError)
          const zodError = error as ZodError
          expect(Array.isArray(zodError.issues)).toBe(true)
          expect(zodError.issues.length).toBeGreaterThan(0)
          expect(zodError.issues[0]).toHaveProperty('code')
          expect(zodError.issues[0]).toHaveProperty('message')
          expect(zodError.issues[0]).toHaveProperty('path')
        }
      })

      it('should support flatten() on ZodError', () => {
        const schema = z.object({
          name: z.string(),
          age: z.number(),
        })

        const result = schema.safeParse({ name: 123, age: 'bad' })
        expect(result.success).toBe(false)
        if (!result.success) {
          const flattened = result.error.flatten()
          expect(flattened).toHaveProperty('fieldErrors')
          expect(flattened).toHaveProperty('formErrors')
          expect(flattened.fieldErrors).toHaveProperty('name')
          expect(flattened.fieldErrors).toHaveProperty('age')
        }
      })
    })

    describe('ZodIssueCode constants', () => {
      it('should expose ZodIssueCode.custom', () => {
        // v3: z.ZodIssueCode.custom
        // v4: may change internal structure
        expect(z.ZodIssueCode.custom).toBe('custom')
      })

      it('should support ZodIssueCode in superRefine', () => {
        const schema = z
          .object({
            start: z.number(),
            end: z.number(),
          })
          .superRefine((data, ctx) => {
            if (data.end <= data.start) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'End must be after start',
                path: ['end'],
              })
            }
          })

        const result = schema.safeParse({ start: 10, end: 5 })
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toBe('End must be after start')
          expect(result.error.issues[0].path).toEqual(['end'])
        }
      })
    })

    describe('Actual usage patterns from MBC MCP Server source', () => {
      it('should match ValidateCqrsSchema pattern (validate.ts)', () => {
        // Exact pattern from packages/mcp-server/src/tools/validate.ts
        const ValidateCqrsSchema = z.object({
          path: z
            .string()
            .optional()
            .describe('Path to validate (defaults to project root)'),
        })

        expect(ValidateCqrsSchema.parse({})).toEqual({})
        expect(ValidateCqrsSchema.parse({ path: '/src' })).toEqual({
          path: '/src',
        })
      })

      it('should match AnalyzeProjectSchema pattern (analyze.ts)', () => {
        // Exact pattern from packages/mcp-server/src/tools/analyze.ts
        const AnalyzeProjectSchema = z.object({
          path: z
            .string()
            .optional()
            .describe('Path to analyze (defaults to project root)'),
        })

        expect(AnalyzeProjectSchema.parse({})).toEqual({})
        expect(AnalyzeProjectSchema.parse({ path: '/project' })).toEqual({
          path: '/project',
        })
      })

      it('should match LookupErrorSchema pattern (analyze.ts)', () => {
        const LookupErrorSchema = z.object({
          error_message: z.string().describe('The error message to look up'),
        })

        expect(
          LookupErrorSchema.parse({ error_message: 'some error' }),
        ).toEqual({ error_message: 'some error' })
        expect(() => LookupErrorSchema.parse({})).toThrow(ZodError)
      })

      it('should match CheckAntiPatternsSchema pattern (analyze.ts)', () => {
        const CheckAntiPatternsSchema = z.object({
          path: z
            .string()
            .optional()
            .describe('Path to check (defaults to src/)'),
        })

        expect(CheckAntiPatternsSchema.parse({})).toEqual({})
      })

      it('should match HealthCheckSchema pattern (analyze.ts)', () => {
        const HealthCheckSchema = z.object({})

        expect(HealthCheckSchema.parse({})).toEqual({})
      })

      it('should match ExplainCodeSchema pattern (analyze.ts)', () => {
        const ExplainCodeSchema = z.object({
          file_path: z.string().describe('Path to the file to explain'),
          start_line: z.number().optional().describe('Starting line number'),
          end_line: z.number().optional().describe('Ending line number'),
        })

        expect(ExplainCodeSchema.parse({ file_path: '/src/main.ts' })).toEqual({
          file_path: '/src/main.ts',
        })
        expect(
          ExplainCodeSchema.parse({
            file_path: '/src/main.ts',
            start_line: 1,
            end_line: 10,
          }),
        ).toEqual({ file_path: '/src/main.ts', start_line: 1, end_line: 10 })
      })

      it('should match GenerateModuleSchema pattern (generate.ts)', () => {
        const GenerateModuleSchema = z.object({
          name: z
            .string()
            .describe(
              'Name of the module to generate (e.g., "order", "product")',
            ),
          mode: z
            .enum(['async', 'sync'])
            .optional()
            .describe('Command processing mode: async (default) or sync'),
        })

        expect(GenerateModuleSchema.parse({ name: 'order' })).toEqual({
          name: 'order',
        })
        expect(
          GenerateModuleSchema.parse({ name: 'order', mode: 'sync' }),
        ).toEqual({ name: 'order', mode: 'sync' })
      })

      it('should match GenerateComponentSchema pattern (generate.ts)', () => {
        const GenerateComponentSchema = z.object({
          name: z.string().describe('Name of the component to generate'),
        })

        expect(GenerateComponentSchema.parse({ name: 'my-service' })).toEqual({
          name: 'my-service',
        })
      })
    })
  })
})
