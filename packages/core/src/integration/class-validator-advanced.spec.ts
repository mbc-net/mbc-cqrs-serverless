/**
 * class-validator Advanced Integration Tests
 *
 * This file tests advanced class-validator behavior:
 * - Custom async validators
 * - Conditional validation
 * - Validation groups
 * - Custom validation decorators
 * - Nested validation
 * - Validation error messages
 *
 * These tests verify that class-validator patterns work correctly
 * across package version updates.
 */
import {
  validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
  IsString,
  IsNumber,
  IsEmail,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsOptional,
  IsNotEmpty,
  ValidateNested,
  ValidateIf,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  Matches,
  IsEnum,
  IsBoolean,
  Equals,
  IsDefined,
} from 'class-validator'
import { Type } from 'class-transformer'
import 'reflect-metadata'

describe('class-validator Advanced Integration', () => {
  // ============================================================================
  // Custom Async Validator Tests
  // ============================================================================
  describe('Custom Async Validators', () => {
    /**
     * Simulated async validation (e.g., database check)
     */
    @ValidatorConstraint({ name: 'isUniqueEmail', async: true })
    class IsUniqueEmailConstraint implements ValidatorConstraintInterface {
      private existingEmails = new Set(['taken@example.com', 'admin@example.com'])

      async validate(email: string): Promise<boolean> {
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 10))
        return !this.existingEmails.has(email)
      }

      defaultMessage(): string {
        return 'Email ($value) is already taken'
      }
    }

    function IsUniqueEmail(validationOptions?: ValidationOptions) {
      return function (object: object, propertyName: string) {
        registerDecorator({
          target: object.constructor,
          propertyName: propertyName,
          options: validationOptions,
          constraints: [],
          validator: IsUniqueEmailConstraint,
        })
      }
    }

    class UserRegistration {
      @IsEmail()
      @IsUniqueEmail()
      email!: string

      @IsString()
      @MinLength(8)
      password!: string
    }

    it('should validate unique email asynchronously', async () => {
      const user = new UserRegistration()
      user.email = 'new@example.com'
      user.password = 'password123'

      const errors = await validate(user)
      expect(errors).toHaveLength(0)
    })

    it('should reject taken email asynchronously', async () => {
      const user = new UserRegistration()
      user.email = 'taken@example.com'
      user.password = 'password123'

      const errors = await validate(user)
      expect(errors).toHaveLength(1)
      expect(errors[0].constraints).toHaveProperty('isUniqueEmail')
    })

    /**
     * Async validator with external service simulation
     */
    @ValidatorConstraint({ name: 'isValidPostalCode', async: true })
    class IsValidPostalCodeConstraint implements ValidatorConstraintInterface {
      private validPrefixes = ['100', '200', '300', '400', '500']

      async validate(postalCode: string): Promise<boolean> {
        await new Promise((resolve) => setTimeout(resolve, 5))
        const prefix = postalCode?.substring(0, 3)
        return this.validPrefixes.includes(prefix)
      }

      defaultMessage(args: ValidationArguments): string {
        return `${args.property} ($value) is not a valid postal code`
      }
    }

    function IsValidPostalCode(validationOptions?: ValidationOptions) {
      return function (object: object, propertyName: string) {
        registerDecorator({
          target: object.constructor,
          propertyName: propertyName,
          options: validationOptions,
          validator: IsValidPostalCodeConstraint,
        })
      }
    }

    class Address {
      @IsString()
      street!: string

      @IsString()
      @IsValidPostalCode()
      postalCode!: string
    }

    it('should validate postal code asynchronously', async () => {
      const address = new Address()
      address.street = '123 Main St'
      address.postalCode = '100-0001'

      const errors = await validate(address)
      expect(errors).toHaveLength(0)
    })

    it('should reject invalid postal code', async () => {
      const address = new Address()
      address.street = '123 Main St'
      address.postalCode = '999-0001'

      const errors = await validate(address)
      expect(errors.length).toBeGreaterThan(0)
      const postalError = errors.find((e) => e.property === 'postalCode')
      expect(postalError).toBeDefined()
    })
  })

  // ============================================================================
  // Conditional Validation Tests
  // ============================================================================
  describe('Conditional Validation', () => {
    enum PaymentMethod {
      CREDIT_CARD = 'credit_card',
      BANK_TRANSFER = 'bank_transfer',
      PAYPAL = 'paypal',
    }

    class PaymentDto {
      @IsEnum(PaymentMethod)
      method!: PaymentMethod

      // Only required for credit card
      @ValidateIf((o: PaymentDto) => o.method === PaymentMethod.CREDIT_CARD)
      @IsString()
      @Matches(/^\d{16}$/)
      cardNumber?: string

      // Only required for bank transfer
      @ValidateIf((o: PaymentDto) => o.method === PaymentMethod.BANK_TRANSFER)
      @IsString()
      @MinLength(10)
      accountNumber?: string

      // Only required for PayPal
      @ValidateIf((o: PaymentDto) => o.method === PaymentMethod.PAYPAL)
      @IsEmail()
      paypalEmail?: string
    }

    it('should validate credit card payment', async () => {
      const payment = new PaymentDto()
      payment.method = PaymentMethod.CREDIT_CARD
      payment.cardNumber = '1234567890123456'

      const errors = await validate(payment)
      expect(errors).toHaveLength(0)
    })

    it('should reject credit card payment without card number', async () => {
      const payment = new PaymentDto()
      payment.method = PaymentMethod.CREDIT_CARD

      const errors = await validate(payment)
      const cardError = errors.find((e) => e.property === 'cardNumber')
      expect(cardError).toBeDefined()
    })

    it('should validate bank transfer without card number', async () => {
      const payment = new PaymentDto()
      payment.method = PaymentMethod.BANK_TRANSFER
      payment.accountNumber = '1234567890'

      const errors = await validate(payment)
      expect(errors).toHaveLength(0)
    })

    it('should validate paypal payment', async () => {
      const payment = new PaymentDto()
      payment.method = PaymentMethod.PAYPAL
      payment.paypalEmail = 'user@example.com'

      const errors = await validate(payment)
      expect(errors).toHaveLength(0)
    })

    it('should not require card for non-card payments', async () => {
      const payment = new PaymentDto()
      payment.method = PaymentMethod.BANK_TRANSFER
      payment.accountNumber = '1234567890'
      // No card number provided, but that's OK

      const errors = await validate(payment)
      expect(errors).toHaveLength(0)
    })
  })

  // ============================================================================
  // Validation Groups Tests
  // ============================================================================
  describe('Validation Groups', () => {
    class UserDto {
      @IsNumber({}, { groups: ['update'] })
      @IsDefined({ groups: ['update'] })
      id?: number

      @IsString({ groups: ['create', 'update'] })
      @MinLength(2, { groups: ['create', 'update'] })
      @IsDefined({ groups: ['create'] })
      name!: string

      @IsEmail({}, { groups: ['create', 'update'] })
      @IsDefined({ groups: ['create'] })
      email!: string

      @IsString({ groups: ['create'] })
      @MinLength(8, { groups: ['create'] })
      @IsDefined({ groups: ['create'] })
      password?: string
    }

    it('should validate with create group', async () => {
      const user = new UserDto()
      user.name = 'John'
      user.email = 'john@example.com'
      user.password = 'password123'

      const errors = await validate(user, { groups: ['create'] })
      expect(errors).toHaveLength(0)
    })

    it('should reject create without required fields', async () => {
      const user = new UserDto()
      user.name = 'John'
      // Missing email and password

      const errors = await validate(user, { groups: ['create'] })
      expect(errors.length).toBeGreaterThan(0)
    })

    it('should validate with update group', async () => {
      const user = new UserDto()
      user.id = 1
      user.name = 'John Updated'
      user.email = 'john.updated@example.com'
      // Password not required for update

      const errors = await validate(user, { groups: ['update'] })
      expect(errors).toHaveLength(0)
    })

    it('should require id for update group', async () => {
      const user = new UserDto()
      user.name = 'John'
      user.email = 'john@example.com'
      // Missing id

      const errors = await validate(user, { groups: ['update'] })
      const idError = errors.find((e) => e.property === 'id')
      expect(idError).toBeDefined()
    })

    it('should validate only matching group decorators', async () => {
      // When using groups, only decorators with matching groups are applied
      // Decorators without groups are NOT validated when any group is specified
      const user = new UserDto()
      user.name = 'Jo' // Valid for minLength(2)
      user.email = 'jo@test.com'
      // No password, no id - but update group doesn't require password

      const errors = await validate(user, { groups: ['update'] })
      // Should fail because id is required for update group
      const idError = errors.find((e) => e.property === 'id')
      expect(idError).toBeDefined()
    })
  })

  // ============================================================================
  // Nested Validation Tests
  // ============================================================================
  describe('Nested Validation', () => {
    class AddressDto {
      @IsString()
      @IsNotEmpty()
      street!: string

      @IsString()
      @IsNotEmpty()
      city!: string

      @IsString()
      @MinLength(5)
      zipCode!: string
    }

    class PhoneDto {
      @IsString()
      @Matches(/^\+\d{1,3}$/)
      countryCode!: string

      @IsString()
      @Matches(/^\d{10}$/)
      number!: string
    }

    class ProfileDto {
      @IsString()
      @MinLength(2)
      firstName!: string

      @IsString()
      @MinLength(2)
      lastName!: string

      @ValidateNested()
      @Type(() => AddressDto)
      address!: AddressDto

      @ValidateNested({ each: true })
      @Type(() => PhoneDto)
      @IsArray()
      @ArrayMinSize(1)
      phones!: PhoneDto[]
    }

    it('should validate nested objects', async () => {
      const profile = new ProfileDto()
      profile.firstName = 'John'
      profile.lastName = 'Doe'
      profile.address = new AddressDto()
      profile.address.street = '123 Main St'
      profile.address.city = 'New York'
      profile.address.zipCode = '10001'
      profile.phones = [new PhoneDto()]
      profile.phones[0].countryCode = '+1'
      profile.phones[0].number = '1234567890'

      const errors = await validate(profile)
      expect(errors).toHaveLength(0)
    })

    it('should validate nested object errors', async () => {
      const profile = new ProfileDto()
      profile.firstName = 'John'
      profile.lastName = 'Doe'
      profile.address = new AddressDto()
      profile.address.street = '' // Invalid
      profile.address.city = 'NY'
      profile.address.zipCode = '123' // Too short
      profile.phones = [new PhoneDto()]
      profile.phones[0].countryCode = '+1'
      profile.phones[0].number = '1234567890'

      const errors = await validate(profile)
      const addressErrors = errors.find((e) => e.property === 'address')
      expect(addressErrors).toBeDefined()
      expect(addressErrors?.children?.length).toBeGreaterThan(0)
    })

    it('should validate nested array elements', async () => {
      const profile = new ProfileDto()
      profile.firstName = 'John'
      profile.lastName = 'Doe'
      profile.address = new AddressDto()
      profile.address.street = '123 Main St'
      profile.address.city = 'New York'
      profile.address.zipCode = '10001'
      profile.phones = [new PhoneDto(), new PhoneDto()]
      profile.phones[0].countryCode = '+1'
      profile.phones[0].number = '1234567890'
      profile.phones[1].countryCode = 'invalid' // Invalid
      profile.phones[1].number = '123' // Too short

      const errors = await validate(profile)
      const phonesErrors = errors.find((e) => e.property === 'phones')
      expect(phonesErrors).toBeDefined()
      expect(phonesErrors?.children).toBeDefined()
    })

    it('should reject empty phones array', async () => {
      const profile = new ProfileDto()
      profile.firstName = 'John'
      profile.lastName = 'Doe'
      profile.address = new AddressDto()
      profile.address.street = '123 Main St'
      profile.address.city = 'New York'
      profile.address.zipCode = '10001'
      profile.phones = []

      const errors = await validate(profile)
      const phonesError = errors.find((e) => e.property === 'phones')
      expect(phonesError).toBeDefined()
    })
  })

  // ============================================================================
  // Custom Decorators with Parameters
  // ============================================================================
  describe('Custom Decorators with Parameters', () => {
    /**
     * Custom decorator that validates a range
     */
    @ValidatorConstraint({ name: 'isInRange', async: false })
    class IsInRangeConstraint implements ValidatorConstraintInterface {
      validate(value: number, args: ValidationArguments): boolean {
        const [min, max] = args.constraints as [number, number]
        return value >= min && value <= max
      }

      defaultMessage(args: ValidationArguments): string {
        const [min, max] = args.constraints as [number, number]
        return `${args.property} must be between ${min} and ${max}`
      }
    }

    function IsInRange(min: number, max: number, options?: ValidationOptions) {
      return function (object: object, propertyName: string) {
        registerDecorator({
          target: object.constructor,
          propertyName: propertyName,
          options: options,
          constraints: [min, max],
          validator: IsInRangeConstraint,
        })
      }
    }

    /**
     * Custom decorator that validates based on another property
     */
    @ValidatorConstraint({ name: 'isGreaterThan', async: false })
    class IsGreaterThanConstraint implements ValidatorConstraintInterface {
      validate(value: number, args: ValidationArguments): boolean {
        const [relatedPropertyName] = args.constraints as [string]
        const relatedValue = (args.object as Record<string, number>)[relatedPropertyName]
        return value > relatedValue
      }

      defaultMessage(args: ValidationArguments): string {
        const [relatedPropertyName] = args.constraints as [string]
        return `${args.property} must be greater than ${relatedPropertyName}`
      }
    }

    function IsGreaterThan(property: string, options?: ValidationOptions) {
      return function (object: object, propertyName: string) {
        registerDecorator({
          target: object.constructor,
          propertyName: propertyName,
          options: options,
          constraints: [property],
          validator: IsGreaterThanConstraint,
        })
      }
    }

    class ProductDto {
      @IsNumber()
      @IsInRange(0, 1000)
      price!: number

      @IsNumber()
      @IsInRange(0, 100)
      discount!: number

      @IsNumber()
      @Min(1)
      @Max(1000)
      quantity!: number

      @IsNumber()
      @IsGreaterThan('price')
      maxPrice!: number
    }

    it('should validate with custom range', async () => {
      const product = new ProductDto()
      product.price = 100
      product.discount = 10
      product.quantity = 5
      product.maxPrice = 150

      const errors = await validate(product)
      expect(errors).toHaveLength(0)
    })

    it('should reject value outside range', async () => {
      const product = new ProductDto()
      product.price = 1500 // Out of range
      product.discount = 10
      product.quantity = 5
      product.maxPrice = 2000

      const errors = await validate(product)
      const priceError = errors.find((e) => e.property === 'price')
      expect(priceError).toBeDefined()
      expect(priceError?.constraints?.isInRange).toContain('between')
    })

    it('should validate property comparison', async () => {
      const product = new ProductDto()
      product.price = 100
      product.discount = 10
      product.quantity = 5
      product.maxPrice = 50 // Less than price

      const errors = await validate(product)
      const maxPriceError = errors.find((e) => e.property === 'maxPrice')
      expect(maxPriceError).toBeDefined()
    })
  })

  // ============================================================================
  // Error Messages Tests
  // ============================================================================
  describe('Error Messages', () => {
    class FormDto {
      @IsString({ message: 'Name must be a string' })
      @MinLength(2, { message: 'Name must be at least 2 characters' })
      @MaxLength(50, { message: 'Name cannot exceed 50 characters' })
      name!: string

      @IsEmail({}, { message: 'Please provide a valid email address' })
      email!: string

      @IsNumber({}, { message: 'Age must be a number' })
      @Min(0, { message: 'Age cannot be negative' })
      @Max(150, { message: 'Age cannot exceed 150' })
      age!: number
    }

    it('should use custom error messages', async () => {
      const form = new FormDto()
      form.name = 'A' // Too short
      form.email = 'invalid'
      form.age = -5

      const errors = await validate(form)

      const nameError = errors.find((e) => e.property === 'name')
      expect(nameError?.constraints?.minLength).toBe(
        'Name must be at least 2 characters',
      )

      const emailError = errors.find((e) => e.property === 'email')
      expect(emailError?.constraints?.isEmail).toBe(
        'Please provide a valid email address',
      )

      const ageError = errors.find((e) => e.property === 'age')
      expect(ageError?.constraints?.min).toBe('Age cannot be negative')
    })

    class DynamicMessageDto {
      @IsNumber()
      @Min(10, {
        message: (args: ValidationArguments) =>
          `${args.property} must be at least ${args.constraints[0]}, got ${args.value}`,
      })
      score!: number
    }

    it('should use dynamic error messages', async () => {
      const dto = new DynamicMessageDto()
      dto.score = 5

      const errors = await validate(dto)
      const scoreError = errors.find((e) => e.property === 'score')
      expect(scoreError?.constraints?.min).toBe(
        'score must be at least 10, got 5',
      )
    })
  })

  // ============================================================================
  // Array Validation Tests
  // ============================================================================
  describe('Array Validation', () => {
    class TagsDto {
      @IsArray()
      @ArrayMinSize(1, { message: 'At least one tag is required' })
      @ArrayMaxSize(5, { message: 'Maximum 5 tags allowed' })
      @IsString({ each: true })
      @MinLength(2, { each: true })
      tags!: string[]
    }

    it('should validate array with valid items', async () => {
      const dto = new TagsDto()
      dto.tags = ['javascript', 'typescript', 'nodejs']

      const errors = await validate(dto)
      expect(errors).toHaveLength(0)
    })

    it('should reject empty array', async () => {
      const dto = new TagsDto()
      dto.tags = []

      const errors = await validate(dto)
      const tagsError = errors.find((e) => e.property === 'tags')
      expect(tagsError?.constraints?.arrayMinSize).toBe(
        'At least one tag is required',
      )
    })

    it('should reject array exceeding max size', async () => {
      const dto = new TagsDto()
      dto.tags = ['a', 'b', 'c', 'd', 'e', 'f']

      const errors = await validate(dto)
      const tagsError = errors.find((e) => e.property === 'tags')
      expect(tagsError?.constraints?.arrayMaxSize).toBe('Maximum 5 tags allowed')
    })

    it('should validate each item in array', async () => {
      const dto = new TagsDto()
      dto.tags = ['javascript', 'x'] // 'x' is too short

      const errors = await validate(dto)
      const tagsError = errors.find((e) => e.property === 'tags')
      expect(tagsError).toBeDefined()
    })
  })

  // ============================================================================
  // Boolean and Equality Tests
  // ============================================================================
  describe('Boolean and Equality Validation', () => {
    class TermsDto {
      @IsBoolean()
      @Equals(true, { message: 'You must accept the terms' })
      acceptTerms!: boolean

      @IsBoolean()
      @IsOptional()
      subscribeNewsletter?: boolean
    }

    it('should validate accepted terms', async () => {
      const dto = new TermsDto()
      dto.acceptTerms = true

      const errors = await validate(dto)
      expect(errors).toHaveLength(0)
    })

    it('should reject unaccepted terms', async () => {
      const dto = new TermsDto()
      dto.acceptTerms = false

      const errors = await validate(dto)
      const termsError = errors.find((e) => e.property === 'acceptTerms')
      expect(termsError?.constraints?.equals).toBe('You must accept the terms')
    })

    it('should allow optional boolean', async () => {
      const dto = new TermsDto()
      dto.acceptTerms = true
      // subscribeNewsletter is optional

      const errors = await validate(dto)
      expect(errors).toHaveLength(0)
    })
  })

  // ============================================================================
  // Whitelist and Forbid Non-Whitelisted Tests
  // ============================================================================
  describe('Whitelist Validation', () => {
    class StrictDto {
      @IsString()
      name!: string

      @IsNumber()
      age!: number
    }

    it('should strip unknown properties with whitelist option', async () => {
      const plain = {
        name: 'John',
        age: 30,
        unknownField: 'should be stripped',
      }

      const dto = Object.assign(new StrictDto(), plain)
      const errors = await validate(dto, { whitelist: true })

      expect(errors).toHaveLength(0)
    })

    it('should reject unknown properties with forbidNonWhitelisted', async () => {
      const plain = {
        name: 'John',
        age: 30,
        unknownField: 'should cause error',
      }

      const dto = Object.assign(new StrictDto(), plain)
      const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
      })

      const unknownError = errors.find((e) => e.property === 'unknownField')
      expect(unknownError).toBeDefined()
    })
  })

  // ============================================================================
  // Skip Missing Properties Tests
  // ============================================================================
  describe('Skip Missing Properties', () => {
    class OptionalFieldsDto {
      @IsString()
      @IsOptional()
      name?: string

      @IsNumber()
      @IsOptional()
      age?: number
    }

    it('should skip validation for undefined optional fields', async () => {
      const dto = new OptionalFieldsDto()
      // No fields set

      const errors = await validate(dto, { skipMissingProperties: true })
      expect(errors).toHaveLength(0)
    })

    it('should validate provided optional fields', async () => {
      const dto = new OptionalFieldsDto()
      dto.name = '' // Empty string, but type is correct

      const errors = await validate(dto)
      expect(errors).toHaveLength(0)
    })
  })
})
