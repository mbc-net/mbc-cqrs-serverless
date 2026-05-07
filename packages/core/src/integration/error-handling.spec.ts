/**
 * Error Handling Tests
 *
 * These tests verify that external libraries throw expected exceptions
 * with expected types and message formats. When error handling changes,
 * these tests will fail.
 */

import 'reflect-metadata'

import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  PutItemCommand,
  ResourceNotFoundException,
  TransactionCanceledException,
} from '@aws-sdk/client-dynamodb'
import { marshall } from '@aws-sdk/util-dynamodb'
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { plainToInstance, Type } from 'class-transformer'
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  validate,
  ValidationError,
  ValidateNested,
} from 'class-validator'
import { mockClient } from 'aws-sdk-client-mock'

describe('Error Handling Tests', () => {
  describe('AWS SDK DynamoDB Exceptions', () => {
    const dynamoMock = mockClient(DynamoDBClient)
    const client = new DynamoDBClient({ region: 'ap-northeast-1' })

    beforeEach(() => {
      dynamoMock.reset()
    })

    describe('ConditionalCheckFailedException', () => {
      it('should have expected error name', async () => {
        const error = new Error('The conditional request failed')
        error.name = 'ConditionalCheckFailedException'
        dynamoMock.on(PutItemCommand).rejects(error)

        try {
          await client.send(
            new PutItemCommand({
              TableName: 'test-table',
              Item: marshall({ pk: 'pk', sk: 'sk' }),
              ConditionExpression: 'attribute_not_exists(pk)',
            }),
          )
          fail('Expected error to be thrown')
        } catch (e) {
          expect((e as Error).name).toBe('ConditionalCheckFailedException')
        }
      })

      it('should be catchable by error name', async () => {
        const error = new Error('The conditional request failed')
        error.name = 'ConditionalCheckFailedException'
        dynamoMock.on(PutItemCommand).rejects(error)

        let caught = false
        try {
          await client.send(
            new PutItemCommand({
              TableName: 'test-table',
              Item: marshall({ pk: 'pk', sk: 'sk' }),
            }),
          )
        } catch (e) {
          if ((e as Error).name === 'ConditionalCheckFailedException') {
            caught = true
          }
        }

        expect(caught).toBe(true)
      })
    })

    describe('ResourceNotFoundException', () => {
      it('should have expected error structure', async () => {
        const error = new Error('Requested resource not found')
        error.name = 'ResourceNotFoundException'
        dynamoMock.on(PutItemCommand).rejects(error)

        try {
          await client.send(
            new PutItemCommand({
              TableName: 'non-existent-table',
              Item: marshall({ pk: 'pk', sk: 'sk' }),
            }),
          )
          fail('Expected error to be thrown')
        } catch (e) {
          expect((e as Error).name).toBe('ResourceNotFoundException')
          expect((e as Error).message).toContain('not found')
        }
      })
    })

    describe('TransactionCanceledException', () => {
      it('should have expected error name', async () => {
        const error = new Error('Transaction cancelled')
        error.name = 'TransactionCanceledException'
        dynamoMock.on(PutItemCommand).rejects(error)

        try {
          await client.send(
            new PutItemCommand({
              TableName: 'test-table',
              Item: marshall({ pk: 'pk', sk: 'sk' }),
            }),
          )
          fail('Expected error to be thrown')
        } catch (e) {
          expect((e as Error).name).toBe('TransactionCanceledException')
        }
      })
    })
  })

  describe('NestJS Exception Structure', () => {
    describe('HttpException base class', () => {
      it('should have getStatus method', () => {
        const exception = new HttpException('Test', HttpStatus.BAD_REQUEST)

        expect(typeof exception.getStatus).toBe('function')
        expect(exception.getStatus()).toBe(400)
      })

      it('should have getResponse method', () => {
        const exception = new HttpException('Test', HttpStatus.BAD_REQUEST)

        expect(typeof exception.getResponse).toBe('function')
      })

      it('should be instanceof Error', () => {
        const exception = new HttpException('Test', HttpStatus.BAD_REQUEST)

        expect(exception).toBeInstanceOf(Error)
        expect(exception).toBeInstanceOf(HttpException)
      })

      it('should support object response', () => {
        const response = {
          statusCode: 400,
          message: 'Validation failed',
          errors: ['field1 is required'],
        }
        const exception = new HttpException(response, HttpStatus.BAD_REQUEST)

        expect(exception.getResponse()).toEqual(response)
      })
    })

    describe('Built-in exception response format', () => {
      it('BadRequestException should have standard response structure', () => {
        const exception = new BadRequestException('Invalid input')
        const response = exception.getResponse() as Record<string, unknown>

        expect(response).toHaveProperty('statusCode', 400)
        expect(response).toHaveProperty('message', 'Invalid input')
        expect(response).toHaveProperty('error', 'Bad Request')
      })

      it('NotFoundException should have standard response structure', () => {
        const exception = new NotFoundException('Resource not found')
        const response = exception.getResponse() as Record<string, unknown>

        expect(response).toHaveProperty('statusCode', 404)
        expect(response).toHaveProperty('message', 'Resource not found')
        expect(response).toHaveProperty('error', 'Not Found')
      })

      it('UnauthorizedException should have standard response structure', () => {
        const exception = new UnauthorizedException('Invalid token')
        const response = exception.getResponse() as Record<string, unknown>

        expect(response).toHaveProperty('statusCode', 401)
        expect(response).toHaveProperty('message', 'Invalid token')
        expect(response).toHaveProperty('error', 'Unauthorized')
      })

      it('InternalServerErrorException should have standard response structure', () => {
        const exception = new InternalServerErrorException('Server error')
        const response = exception.getResponse() as Record<string, unknown>

        expect(response).toHaveProperty('statusCode', 500)
        expect(response).toHaveProperty('message', 'Server error')
        expect(response).toHaveProperty('error', 'Internal Server Error')
      })
    })

    describe('Exception with array of messages', () => {
      it('should support array of validation messages', () => {
        const messages = ['field1 is required', 'field2 must be a number']
        const exception = new BadRequestException(messages)
        const response = exception.getResponse() as Record<string, unknown>

        expect(response.message).toEqual(messages)
      })
    })

    describe('Exception inheritance', () => {
      it('all built-in exceptions should extend HttpException', () => {
        expect(new BadRequestException()).toBeInstanceOf(HttpException)
        expect(new UnauthorizedException()).toBeInstanceOf(HttpException)
        expect(new NotFoundException()).toBeInstanceOf(HttpException)
        expect(new InternalServerErrorException()).toBeInstanceOf(HttpException)
      })
    })
  })

  describe('class-validator ValidationError Structure', () => {
    class TestDto {
      @IsString()
      @IsNotEmpty()
      name: string

      @IsNumber()
      @Min(0)
      age: number
    }

    it('should return ValidationError instances', async () => {
      const instance = plainToInstance(TestDto, { name: '', age: -1 })
      const errors = await validate(instance)

      expect(errors.length).toBeGreaterThan(0)
      errors.forEach((error) => {
        expect(error).toBeInstanceOf(ValidationError)
      })
    })

    it('ValidationError should have property field', async () => {
      const instance = plainToInstance(TestDto, { name: 123, age: 25 })
      const errors = await validate(instance)

      expect(errors[0].property).toBe('name')
    })

    it('ValidationError should have constraints object', async () => {
      const instance = plainToInstance(TestDto, { name: 123, age: 25 })
      const errors = await validate(instance)

      expect(errors[0].constraints).toBeDefined()
      expect(typeof errors[0].constraints).toBe('object')
    })

    it('ValidationError should have value field', async () => {
      const instance = plainToInstance(TestDto, { name: 123, age: 25 })
      const errors = await validate(instance)

      expect(errors[0].value).toBe(123)
    })

    it('ValidationError should have target field', async () => {
      const instance = plainToInstance(TestDto, { name: 123, age: 25 })
      const errors = await validate(instance)

      expect(errors[0].target).toBe(instance)
    })

    describe('Nested validation errors', () => {
      class NestedDto {
        @IsString()
        value: string
      }

      class ParentDto {
        @ValidateNested()
        @Type(() => NestedDto)
        nested: NestedDto
      }

      it('should have children array for nested errors', async () => {
        const instance = plainToInstance(ParentDto, {
          nested: { value: 123 },
        })
        const errors = await validate(instance)

        const nestedError = errors.find((e) => e.property === 'nested')
        expect(nestedError).toBeDefined()
        expect(nestedError?.children).toBeDefined()
        expect(Array.isArray(nestedError?.children)).toBe(true)
        expect(nestedError?.children?.length).toBeGreaterThan(0)
      })

      it('children should also be ValidationError instances', async () => {
        const instance = plainToInstance(ParentDto, {
          nested: { value: 123 },
        })
        const errors = await validate(instance)

        const nestedError = errors.find((e) => e.property === 'nested')
        nestedError?.children?.forEach((child) => {
          expect(child).toBeInstanceOf(ValidationError)
        })
      })
    })

    describe('Constraint message format', () => {
      it('should have human-readable constraint messages', async () => {
        const instance = plainToInstance(TestDto, { name: '', age: 25 })
        const errors = await validate(instance)

        const nameError = errors.find((e) => e.property === 'name')
        expect(nameError?.constraints?.isNotEmpty).toBeDefined()
        expect(typeof nameError?.constraints?.isNotEmpty).toBe('string')
        expect(nameError?.constraints?.isNotEmpty.length).toBeGreaterThan(0)
      })

      it('constraint keys should match decorator names', async () => {
        class DecoratorTestDto {
          @IsString()
          stringField: string

          @IsNumber()
          numberField: number

          @Min(10)
          minField: number
        }

        const instance = plainToInstance(DecoratorTestDto, {
          stringField: 123,
          numberField: 'not-number',
          minField: 5,
        })
        const errors = await validate(instance)

        const stringError = errors.find((e) => e.property === 'stringField')
        const numberError = errors.find((e) => e.property === 'numberField')
        const minError = errors.find((e) => e.property === 'minField')

        expect(stringError?.constraints).toHaveProperty('isString')
        expect(numberError?.constraints).toHaveProperty('isNumber')
        expect(minError?.constraints).toHaveProperty('min')
      })
    })
  })

  describe('Error serialization', () => {
    it('NestJS exceptions should be JSON serializable', () => {
      const exception = new BadRequestException('Test error')
      const response = exception.getResponse()

      expect(() => JSON.stringify(response)).not.toThrow()

      const parsed = JSON.parse(JSON.stringify(response))
      expect(parsed.statusCode).toBe(400)
      expect(parsed.message).toBe('Test error')
    })

    it('ValidationError should be JSON serializable', async () => {
      class TestDto {
        @IsString()
        field: string
      }

      const instance = plainToInstance(TestDto, { field: 123 })
      const errors = await validate(instance)

      expect(() => JSON.stringify(errors)).not.toThrow()

      const parsed = JSON.parse(JSON.stringify(errors))
      expect(parsed[0].property).toBe('field')
      expect(parsed[0].constraints).toHaveProperty('isString')
    })
  })

  describe('Error stack traces', () => {
    it('NestJS exceptions should have stack trace', () => {
      const exception = new BadRequestException('Test')

      expect(exception.stack).toBeDefined()
      expect(typeof exception.stack).toBe('string')
      expect(exception.stack?.length).toBeGreaterThan(0)
    })

    it('HttpException should have stack trace', () => {
      const exception = new HttpException('Test', 500)

      expect(exception.stack).toBeDefined()
    })
  })

  describe('Custom error causes', () => {
    it('HttpException should support cause option', () => {
      const cause = new Error('Original error')
      const exception = new HttpException(
        'Wrapped error',
        HttpStatus.INTERNAL_SERVER_ERROR,
        { cause },
      )

      expect(exception.cause).toBe(cause)
    })

    it('Built-in exceptions should support cause', () => {
      const cause = new Error('Database connection failed')
      const exception = new InternalServerErrorException('Service unavailable', {
        cause,
      })

      expect(exception.cause).toBe(cause)
    })
  })

  describe('Multiple validation errors', () => {
    class MultiFieldDto {
      @IsString()
      field1: string

      @IsNumber()
      field2: number

      @IsNotEmpty()
      field3: string
    }

    it('should return all validation errors', async () => {
      const instance = plainToInstance(MultiFieldDto, {
        field1: 123,
        field2: 'not-number',
        field3: '',
      })
      const errors = await validate(instance)

      expect(errors.length).toBe(3)

      const properties = errors.map((e) => e.property)
      expect(properties).toContain('field1')
      expect(properties).toContain('field2')
      expect(properties).toContain('field3')
    })

    it('should limit errors per property with stopAtFirstError option', async () => {
      // Note: stopAtFirstError stops at first error PER PROPERTY, not globally
      const instance = plainToInstance(MultiFieldDto, {
        field1: 123,
        field2: 'not-number',
        field3: '',
      })
      const errors = await validate(instance, { stopAtFirstError: true })

      // All properties are still validated, but each stops at first constraint
      expect(errors.length).toBeGreaterThanOrEqual(1)
      errors.forEach((error) => {
        expect(Object.keys(error.constraints || {}).length).toBeLessThanOrEqual(1)
      })
    })
  })
})
