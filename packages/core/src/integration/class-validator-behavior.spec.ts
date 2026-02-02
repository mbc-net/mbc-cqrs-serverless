/**
 * class-validator Behavioral Tests
 *
 * These tests verify that class-validator behaves as expected.
 * When the library's behavior changes in a new version, these tests will fail.
 */

import 'reflect-metadata'

import { plainToInstance, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  validate,
  ValidateNested,
  ValidationError,
  validateSync,
} from 'class-validator'

describe('class-validator Behavioral Tests', () => {
  describe('Basic type validators', () => {
    class BasicTypes {
      @IsString()
      stringField: string

      @IsNumber()
      numberField: number

      @IsBoolean()
      booleanField: boolean

      @IsInt()
      intField: number
    }

    it('should validate string field correctly', async () => {
      const valid = plainToInstance(BasicTypes, { stringField: 'test' })
      const invalid = plainToInstance(BasicTypes, { stringField: 123 })

      const validErrors = await validate(valid, { skipMissingProperties: true })
      const invalidErrors = await validate(invalid, {
        skipMissingProperties: true,
      })

      expect(validErrors).toHaveLength(0)
      expect(invalidErrors.length).toBeGreaterThan(0)
      expect(invalidErrors[0].property).toBe('stringField')
    })

    it('should validate number field correctly', async () => {
      const valid = plainToInstance(BasicTypes, { numberField: 42.5 })
      const invalid = plainToInstance(BasicTypes, { numberField: 'not-number' })

      const validErrors = await validate(valid, { skipMissingProperties: true })
      const invalidErrors = await validate(invalid, {
        skipMissingProperties: true,
      })

      expect(validErrors).toHaveLength(0)
      expect(invalidErrors.length).toBeGreaterThan(0)
    })

    it('should validate integer field correctly', async () => {
      const validInt = plainToInstance(BasicTypes, { intField: 42 })
      const invalidFloat = plainToInstance(BasicTypes, { intField: 42.5 })

      const validErrors = await validate(validInt, {
        skipMissingProperties: true,
      })
      const invalidErrors = await validate(invalidFloat, {
        skipMissingProperties: true,
      })

      expect(validErrors).toHaveLength(0)
      expect(invalidErrors.length).toBeGreaterThan(0)
      expect(invalidErrors[0].property).toBe('intField')
    })

    it('should validate boolean field correctly', async () => {
      const valid = plainToInstance(BasicTypes, { booleanField: true })
      const invalid = plainToInstance(BasicTypes, { booleanField: 'true' })

      const validErrors = await validate(valid, { skipMissingProperties: true })
      const invalidErrors = await validate(invalid, {
        skipMissingProperties: true,
      })

      expect(validErrors).toHaveLength(0)
      expect(invalidErrors.length).toBeGreaterThan(0)
    })
  })

  describe('@IsOptional behavior', () => {
    class OptionalClass {
      @IsString()
      required: string

      @IsOptional()
      @IsString()
      optional?: string
    }

    it('should fail when required field is missing', async () => {
      const instance = plainToInstance(OptionalClass, {})
      const errors = await validate(instance)

      expect(errors.length).toBeGreaterThan(0)
      expect(errors.some((e) => e.property === 'required')).toBe(true)
    })

    it('should pass when optional field is missing', async () => {
      const instance = plainToInstance(OptionalClass, { required: 'value' })
      const errors = await validate(instance)

      expect(errors).toHaveLength(0)
    })

    it('should validate optional field when present', async () => {
      const valid = plainToInstance(OptionalClass, {
        required: 'value',
        optional: 'also-string',
      })
      const invalid = plainToInstance(OptionalClass, {
        required: 'value',
        optional: 123,
      })

      expect(await validate(valid)).toHaveLength(0)
      expect((await validate(invalid)).length).toBeGreaterThan(0)
    })

    it('should pass when optional field is null', async () => {
      const instance = plainToInstance(OptionalClass, {
        required: 'value',
        optional: null,
      })
      const errors = await validate(instance)

      expect(errors).toHaveLength(0)
    })
  })

  describe('@IsNotEmpty behavior', () => {
    class NotEmptyClass {
      @IsNotEmpty()
      notEmpty: string
    }

    it('should fail on empty string', async () => {
      const instance = plainToInstance(NotEmptyClass, { notEmpty: '' })
      const errors = await validate(instance)

      expect(errors.length).toBeGreaterThan(0)
    })

    it('should pass on whitespace-only string (IsNotEmpty does not trim)', async () => {
      // Note: @IsNotEmpty() does NOT trim whitespace by default
      // Use @IsNotEmpty() with custom validation or @Matches for stricter validation
      const instance = plainToInstance(NotEmptyClass, { notEmpty: '   ' })
      const errors = await validate(instance)

      // Whitespace-only string is considered "not empty" by class-validator
      expect(errors).toHaveLength(0)
    })

    it('should pass on non-empty string', async () => {
      const instance = plainToInstance(NotEmptyClass, { notEmpty: 'value' })
      const errors = await validate(instance)

      expect(errors).toHaveLength(0)
    })
  })

  describe('Length validators', () => {
    class LengthClass {
      @MinLength(3)
      minLength: string

      @MaxLength(10)
      maxLength: string

      @MinLength(2)
      @MaxLength(5)
      rangeLength: string
    }

    it('should validate minimum length', async () => {
      const valid = plainToInstance(LengthClass, { minLength: 'abc' })
      const invalid = plainToInstance(LengthClass, { minLength: 'ab' })

      expect(
        await validate(valid, { skipMissingProperties: true }),
      ).toHaveLength(0)
      expect(
        (await validate(invalid, { skipMissingProperties: true })).length,
      ).toBeGreaterThan(0)
    })

    it('should validate maximum length', async () => {
      const valid = plainToInstance(LengthClass, { maxLength: '1234567890' })
      const invalid = plainToInstance(LengthClass, {
        maxLength: '12345678901',
      })

      expect(
        await validate(valid, { skipMissingProperties: true }),
      ).toHaveLength(0)
      expect(
        (await validate(invalid, { skipMissingProperties: true })).length,
      ).toBeGreaterThan(0)
    })

    it('should validate length range', async () => {
      const tooShort = plainToInstance(LengthClass, { rangeLength: 'a' })
      const valid = plainToInstance(LengthClass, { rangeLength: 'abc' })
      const tooLong = plainToInstance(LengthClass, { rangeLength: 'abcdef' })

      expect(
        (await validate(tooShort, { skipMissingProperties: true })).length,
      ).toBeGreaterThan(0)
      expect(
        await validate(valid, { skipMissingProperties: true }),
      ).toHaveLength(0)
      expect(
        (await validate(tooLong, { skipMissingProperties: true })).length,
      ).toBeGreaterThan(0)
    })
  })

  describe('Numeric range validators', () => {
    class RangeClass {
      @Min(0)
      minValue: number

      @Max(100)
      maxValue: number

      @Min(1)
      @Max(10)
      rangeValue: number
    }

    it('should validate minimum value', async () => {
      const valid = plainToInstance(RangeClass, { minValue: 0 })
      const invalid = plainToInstance(RangeClass, { minValue: -1 })

      expect(
        await validate(valid, { skipMissingProperties: true }),
      ).toHaveLength(0)
      expect(
        (await validate(invalid, { skipMissingProperties: true })).length,
      ).toBeGreaterThan(0)
    })

    it('should validate maximum value', async () => {
      const valid = plainToInstance(RangeClass, { maxValue: 100 })
      const invalid = plainToInstance(RangeClass, { maxValue: 101 })

      expect(
        await validate(valid, { skipMissingProperties: true }),
      ).toHaveLength(0)
      expect(
        (await validate(invalid, { skipMissingProperties: true })).length,
      ).toBeGreaterThan(0)
    })

    it('should validate value range', async () => {
      const tooLow = plainToInstance(RangeClass, { rangeValue: 0 })
      const valid = plainToInstance(RangeClass, { rangeValue: 5 })
      const tooHigh = plainToInstance(RangeClass, { rangeValue: 11 })

      expect(
        (await validate(tooLow, { skipMissingProperties: true })).length,
      ).toBeGreaterThan(0)
      expect(
        await validate(valid, { skipMissingProperties: true }),
      ).toHaveLength(0)
      expect(
        (await validate(tooHigh, { skipMissingProperties: true })).length,
      ).toBeGreaterThan(0)
    })
  })

  describe('@IsEnum behavior', () => {
    enum Status {
      ACTIVE = 'active',
      INACTIVE = 'inactive',
      PENDING = 'pending',
    }

    class EnumClass {
      @IsEnum(Status)
      status: Status
    }

    it('should validate valid enum value', async () => {
      const instance = plainToInstance(EnumClass, { status: 'active' })
      const errors = await validate(instance)

      expect(errors).toHaveLength(0)
    })

    it('should reject invalid enum value', async () => {
      const instance = plainToInstance(EnumClass, { status: 'invalid' })
      const errors = await validate(instance)

      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].property).toBe('status')
    })

    it('should provide valid enum values in error message', async () => {
      const instance = plainToInstance(EnumClass, { status: 'invalid' })
      const errors = await validate(instance)

      expect(errors[0].constraints?.isEnum).toContain('active')
      expect(errors[0].constraints?.isEnum).toContain('inactive')
      expect(errors[0].constraints?.isEnum).toContain('pending')
    })
  })

  describe('@IsEmail behavior', () => {
    class EmailClass {
      @IsEmail()
      email: string
    }

    it('should validate valid email addresses', async () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.jp',
        'user+tag@example.org',
      ]

      for (const email of validEmails) {
        const instance = plainToInstance(EmailClass, { email })
        const errors = await validate(instance)
        expect(errors).toHaveLength(0)
      }
    })

    it('should reject invalid email addresses', async () => {
      const invalidEmails = ['not-an-email', '@missing-local.com', 'missing@']

      for (const email of invalidEmails) {
        const instance = plainToInstance(EmailClass, { email })
        const errors = await validate(instance)
        expect(errors.length).toBeGreaterThan(0)
      }
    })
  })

  describe('@Matches (regex) behavior', () => {
    class RegexClass {
      @Matches(/^[A-Z]{3}-\d{4}$/)
      code: string
    }

    it('should validate matching pattern', async () => {
      const valid = plainToInstance(RegexClass, { code: 'ABC-1234' })
      const errors = await validate(valid)

      expect(errors).toHaveLength(0)
    })

    it('should reject non-matching pattern', async () => {
      const invalid = plainToInstance(RegexClass, { code: 'abc-1234' })
      const errors = await validate(invalid)

      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe('@ValidateNested behavior', () => {
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
    }

    it('should validate nested object', async () => {
      const valid = plainToInstance(Person, {
        name: 'John',
        address: { street: '123 Main St', city: 'Tokyo' },
      })
      const errors = await validate(valid)

      expect(errors).toHaveLength(0)
    })

    it('should report errors in nested object', async () => {
      const invalid = plainToInstance(Person, {
        name: 'John',
        address: { street: 123, city: 'Tokyo' },
      })
      const errors = await validate(invalid)

      expect(errors.length).toBeGreaterThan(0)
      const addressError = errors.find((e) => e.property === 'address')
      expect(addressError).toBeDefined()
      expect(addressError?.children?.length).toBeGreaterThan(0)
    })

    it('should handle null nested object', async () => {
      const instance = plainToInstance(Person, {
        name: 'John',
        address: null,
      })
      const errors = await validate(instance)

      // Null nested object should fail validation (not a valid Address)
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe('Array validators', () => {
    class ArrayClass {
      @IsArray()
      @IsString({ each: true })
      stringArray: string[]

      @ArrayMinSize(1)
      @ArrayMaxSize(5)
      boundedArray: any[]
    }

    it('should validate array of strings', async () => {
      const valid = plainToInstance(ArrayClass, {
        stringArray: ['a', 'b', 'c'],
      })
      const invalid = plainToInstance(ArrayClass, {
        stringArray: ['a', 123, 'c'],
      })

      expect(
        await validate(valid, { skipMissingProperties: true }),
      ).toHaveLength(0)
      expect(
        (await validate(invalid, { skipMissingProperties: true })).length,
      ).toBeGreaterThan(0)
    })

    it('should validate array size bounds', async () => {
      const tooSmall = plainToInstance(ArrayClass, { boundedArray: [] })
      const valid = plainToInstance(ArrayClass, { boundedArray: [1, 2, 3] })
      const tooLarge = plainToInstance(ArrayClass, {
        boundedArray: [1, 2, 3, 4, 5, 6],
      })

      expect(
        (await validate(tooSmall, { skipMissingProperties: true })).length,
      ).toBeGreaterThan(0)
      expect(
        await validate(valid, { skipMissingProperties: true }),
      ).toHaveLength(0)
      expect(
        (await validate(tooLarge, { skipMissingProperties: true })).length,
      ).toBeGreaterThan(0)
    })
  })

  describe('ValidationError structure', () => {
    class ErrorStructureClass {
      @IsString()
      @MinLength(5)
      field: string
    }

    it('should have expected error structure', async () => {
      const instance = plainToInstance(ErrorStructureClass, { field: 123 })
      const errors = await validate(instance)

      expect(errors[0]).toBeInstanceOf(ValidationError)
      expect(errors[0]).toHaveProperty('property')
      expect(errors[0]).toHaveProperty('constraints')
      expect(errors[0]).toHaveProperty('value')
      expect(errors[0]).toHaveProperty('target')
    })

    it('should include all failed constraints', async () => {
      const instance = plainToInstance(ErrorStructureClass, { field: 'ab' })
      const errors = await validate(instance)

      // 'ab' is a string but too short, so only minLength should fail
      expect(errors[0].constraints).toHaveProperty('minLength')
    })
  })

  describe('validateSync behavior', () => {
    class SyncClass {
      @IsString()
      name: string
    }

    it('should return errors synchronously', () => {
      const invalid = plainToInstance(SyncClass, { name: 123 })
      const errors = validateSync(invalid)

      expect(errors.length).toBeGreaterThan(0)
      expect(errors[0].property).toBe('name')
    })

    it('should return empty array for valid object', () => {
      const valid = plainToInstance(SyncClass, { name: 'test' })
      const errors = validateSync(valid)

      expect(errors).toHaveLength(0)
    })
  })

  describe('Validation options', () => {
    class OptionsClass {
      @IsString()
      field1: string

      @IsNumber()
      field2: number
    }

    it('should limit errors per property with stopAtFirstError option', async () => {
      // Note: stopAtFirstError stops at first error PER PROPERTY, not globally
      // Each property will still be validated
      const instance = plainToInstance(OptionsClass, {
        field1: 123,
        field2: 'not-number',
      })
      const errors = await validate(instance, { stopAtFirstError: true })

      // Both properties have errors, but each property stops at first constraint
      expect(errors.length).toBeGreaterThanOrEqual(1)
      // Each error should have at most 1 constraint
      errors.forEach((error) => {
        expect(Object.keys(error.constraints || {}).length).toBeLessThanOrEqual(1)
      })
    })

    it('should skip missing properties with skipMissingProperties', async () => {
      const instance = plainToInstance(OptionsClass, { field1: 'value' })
      const errorsWithSkip = await validate(instance, {
        skipMissingProperties: true,
      })
      const errorsWithoutSkip = await validate(instance)

      expect(errorsWithSkip).toHaveLength(0)
      expect(errorsWithoutSkip.length).toBeGreaterThan(0)
    })

    it('should validate whitelist option', async () => {
      const instance = plainToInstance(OptionsClass, {
        field1: 'value',
        field2: 42,
        extraField: 'should-be-stripped',
      }) as any

      const errors = await validate(instance, {
        whitelist: true,
        forbidNonWhitelisted: true,
      })

      // forbidNonWhitelisted should produce an error for extraField
      expect(errors.some((e) => e.property === 'extraField')).toBe(true)
    })
  })
})
