import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import {
  Environment,
  EnvironmentVariables,
  getValidateConfig,
} from './env.validation'

describe('EnvironmentVariables', () => {
  /**
   * Helper to create a valid base environment configuration
   * Framework users can use this as a reference for required environment variables
   */
  function createValidEnv(
    overrides: Partial<Record<string, unknown>> = {},
  ): Record<string, unknown> {
    return {
      NODE_ENV: 'local',
      APP_NAME: 'test-app',
      EVENT_SOURCE_DISABLED: 'false',
      LOG_LEVEL: 'debug',
      ATTRIBUTE_LIMIT_SIZE: '1000',
      S3_BUCKET_NAME: 'test-bucket',
      SFN_COMMAND_ARN: 'arn:aws:states:us-east-1:123456789012:stateMachine:test',
      SES_FROM_EMAIL: 'test@example.com',
      ...overrides,
    }
  }

  describe('Required Environment Variables', () => {
    it('should validate successfully with all required variables', () => {
      const config = createValidEnv()
      const validate = getValidateConfig()

      expect(() => validate(config)).not.toThrow()
    })

    it('should throw error when NODE_ENV is missing', () => {
      const config = createValidEnv()
      delete config.NODE_ENV

      const validate = getValidateConfig()

      expect(() => validate(config)).toThrow()
    })

    it('should throw error when APP_NAME is missing', () => {
      const config = createValidEnv()
      delete config.APP_NAME

      const validate = getValidateConfig()

      expect(() => validate(config)).toThrow()
    })

    it('should throw error when EVENT_SOURCE_DISABLED is missing', () => {
      const config = createValidEnv()
      delete config.EVENT_SOURCE_DISABLED

      const validate = getValidateConfig()

      expect(() => validate(config)).toThrow()
    })

    it('should throw error when LOG_LEVEL is missing', () => {
      const config = createValidEnv()
      delete config.LOG_LEVEL

      const validate = getValidateConfig()

      expect(() => validate(config)).toThrow()
    })

    it('should throw error when ATTRIBUTE_LIMIT_SIZE is missing', () => {
      const config = createValidEnv()
      delete config.ATTRIBUTE_LIMIT_SIZE

      const validate = getValidateConfig()

      expect(() => validate(config)).toThrow()
    })

    it('should throw error when S3_BUCKET_NAME is missing', () => {
      const config = createValidEnv()
      delete config.S3_BUCKET_NAME

      const validate = getValidateConfig()

      expect(() => validate(config)).toThrow()
    })

    it('should throw error when SFN_COMMAND_ARN is missing', () => {
      const config = createValidEnv()
      delete config.SFN_COMMAND_ARN

      const validate = getValidateConfig()

      expect(() => validate(config)).toThrow()
    })

    it('should throw error when SES_FROM_EMAIL is missing', () => {
      const config = createValidEnv()
      delete config.SES_FROM_EMAIL

      const validate = getValidateConfig()

      expect(() => validate(config)).toThrow()
    })
  })

  describe('Optional Environment Variables', () => {
    it('should validate without optional DYNAMODB_ENDPOINT', () => {
      const config = createValidEnv()
      // DYNAMODB_ENDPOINT is optional

      const validate = getValidateConfig()

      expect(() => validate(config)).not.toThrow()
    })

    it('should validate with DYNAMODB_ENDPOINT set', () => {
      const config = createValidEnv({
        DYNAMODB_ENDPOINT: 'http://localhost:8000',
        DYNAMODB_REGION: 'us-east-1',
      })

      const validate = getValidateConfig()

      expect(() => validate(config)).not.toThrow()
    })

    it('should validate without optional S3_ENDPOINT', () => {
      const config = createValidEnv()
      // S3_ENDPOINT is optional

      const validate = getValidateConfig()

      expect(() => validate(config)).not.toThrow()
    })

    it('should validate with S3_ENDPOINT set', () => {
      const config = createValidEnv({
        S3_ENDPOINT: 'http://localhost:4566',
        S3_REGION: 'us-east-1',
      })

      const validate = getValidateConfig()

      expect(() => validate(config)).not.toThrow()
    })

    it('should validate without optional SFN_ENDPOINT', () => {
      const config = createValidEnv()
      // SFN_ENDPOINT is optional

      const validate = getValidateConfig()

      expect(() => validate(config)).not.toThrow()
    })

    it('should validate with SFN_ENDPOINT set', () => {
      const config = createValidEnv({
        SFN_ENDPOINT: 'http://localhost:8083',
        SFN_REGION: 'us-east-1',
      })

      const validate = getValidateConfig()

      expect(() => validate(config)).not.toThrow()
    })

    it('should validate without optional SNS_ENDPOINT', () => {
      const config = createValidEnv()
      // SNS_ENDPOINT is optional

      const validate = getValidateConfig()

      expect(() => validate(config)).not.toThrow()
    })

    it('should validate with SNS_ENDPOINT set', () => {
      const config = createValidEnv({
        SNS_ENDPOINT: 'http://localhost:4566',
        SNS_REGION: 'us-east-1',
      })

      const validate = getValidateConfig()

      expect(() => validate(config)).not.toThrow()
    })

    it('should validate without optional SES_ENDPOINT', () => {
      const config = createValidEnv()
      // SES_ENDPOINT is optional

      const validate = getValidateConfig()

      expect(() => validate(config)).not.toThrow()
    })

    it('should validate with SES_ENDPOINT set', () => {
      const config = createValidEnv({
        SES_ENDPOINT: 'http://localhost:8005',
        SES_REGION: 'us-east-1',
      })

      const validate = getValidateConfig()

      expect(() => validate(config)).not.toThrow()
    })

    it('should validate without optional APPSYNC_ENDPOINT', () => {
      const config = createValidEnv()
      // APPSYNC_ENDPOINT is optional

      const validate = getValidateConfig()

      expect(() => validate(config)).not.toThrow()
    })

    it('should validate with APPSYNC_ENDPOINT set', () => {
      const config = createValidEnv({
        APPSYNC_ENDPOINT: 'http://localhost:20002',
      })

      const validate = getValidateConfig()

      expect(() => validate(config)).not.toThrow()
    })

    it('should validate without optional APP_PORT', () => {
      const config = createValidEnv()
      // APP_PORT is optional

      const validate = getValidateConfig()

      expect(() => validate(config)).not.toThrow()
    })

    it('should validate with APP_PORT set', () => {
      const config = createValidEnv({
        APP_PORT: '3000',
      })

      const validate = getValidateConfig()

      expect(() => validate(config)).not.toThrow()
    })

    it('should validate without optional REQUEST_BODY_SIZE_LIMIT', () => {
      const config = createValidEnv()
      // REQUEST_BODY_SIZE_LIMIT is optional

      const validate = getValidateConfig()

      expect(() => validate(config)).not.toThrow()
    })

    it('should validate with REQUEST_BODY_SIZE_LIMIT set', () => {
      const config = createValidEnv({
        REQUEST_BODY_SIZE_LIMIT: '10mb',
      })

      const validate = getValidateConfig()

      expect(() => validate(config)).not.toThrow()
    })
  })

  describe('NODE_ENV Validation', () => {
    it('should accept "local" as valid NODE_ENV', () => {
      const config = createValidEnv({ NODE_ENV: 'local' })
      const validate = getValidateConfig()

      const result = validate(config)
      expect(result.NODE_ENV).toBe(Environment.Local)
    })

    it('should accept "dev" as valid NODE_ENV', () => {
      const config = createValidEnv({ NODE_ENV: 'dev' })
      const validate = getValidateConfig()

      const result = validate(config)
      expect(result.NODE_ENV).toBe(Environment.Development)
    })

    it('should accept "stg" as valid NODE_ENV', () => {
      const config = createValidEnv({ NODE_ENV: 'stg' })
      const validate = getValidateConfig()

      const result = validate(config)
      expect(result.NODE_ENV).toBe(Environment.Staging)
    })

    it('should accept "prod" as valid NODE_ENV', () => {
      const config = createValidEnv({ NODE_ENV: 'prod' })
      const validate = getValidateConfig()

      const result = validate(config)
      expect(result.NODE_ENV).toBe(Environment.Production)
    })

    it('should throw error for invalid NODE_ENV value', () => {
      const config = createValidEnv({ NODE_ENV: 'invalid' })
      const validate = getValidateConfig()

      expect(() => validate(config)).toThrow()
    })

    it('should throw error for empty NODE_ENV', () => {
      const config = createValidEnv({ NODE_ENV: '' })
      const validate = getValidateConfig()

      expect(() => validate(config)).toThrow()
    })
  })

  describe('Type Conversions', () => {
    it('should convert EVENT_SOURCE_DISABLED string "true" to boolean true', () => {
      const config = createValidEnv({ EVENT_SOURCE_DISABLED: 'true' })
      const validate = getValidateConfig()

      const result = validate(config)
      expect(result.EVENT_SOURCE_DISABLED).toBe(true)
    })

    it('should convert EVENT_SOURCE_DISABLED boolean false to boolean false', () => {
      // Note: class-transformer's enableImplicitConversion converts non-empty strings to true
      // To pass false, use actual boolean value
      const config = createValidEnv({ EVENT_SOURCE_DISABLED: false })
      const validate = getValidateConfig()

      const result = validate(config)
      expect(result.EVENT_SOURCE_DISABLED).toBe(false)
    })

    it('should convert ATTRIBUTE_LIMIT_SIZE string to number', () => {
      const config = createValidEnv({ ATTRIBUTE_LIMIT_SIZE: '2048' })
      const validate = getValidateConfig()

      const result = validate(config)
      expect(result.ATTRIBUTE_LIMIT_SIZE).toBe(2048)
    })

    it('should throw error for negative ATTRIBUTE_LIMIT_SIZE', () => {
      const config = createValidEnv({ ATTRIBUTE_LIMIT_SIZE: '-100' })
      const validate = getValidateConfig()

      expect(() => validate(config)).toThrow()
    })

    it('should throw error for zero ATTRIBUTE_LIMIT_SIZE', () => {
      const config = createValidEnv({ ATTRIBUTE_LIMIT_SIZE: '0' })
      const validate = getValidateConfig()

      expect(() => validate(config)).toThrow()
    })

    it('should convert APP_PORT string to number when provided', () => {
      const config = createValidEnv({ APP_PORT: '8080' })
      const validate = getValidateConfig()

      const result = validate(config)
      expect(result.APP_PORT).toBe(8080)
    })
  })

  describe('Custom EnvironmentVariables Class Extension', () => {
    it('should allow validation with extended environment variables class', () => {
      class CustomEnvironmentVariables extends EnvironmentVariables {
        CUSTOM_VAR: string
      }

      const config = createValidEnv({
        CUSTOM_VAR: 'custom-value',
      })

      const validate = getValidateConfig(CustomEnvironmentVariables)

      const result = validate(config) as CustomEnvironmentVariables
      expect(result.CUSTOM_VAR).toBe('custom-value')
    })
  })

  describe('Local Development Configuration', () => {
    it('should validate a typical local development configuration', () => {
      const localDevConfig = {
        NODE_ENV: 'local',
        APP_NAME: 'my-serverless-app',
        APP_PORT: '3000',
        EVENT_SOURCE_DISABLED: 'false',
        LOG_LEVEL: 'debug',
        DYNAMODB_ENDPOINT: 'http://localhost:8000',
        DYNAMODB_REGION: 'us-east-1',
        ATTRIBUTE_LIMIT_SIZE: '400000',
        S3_ENDPOINT: 'http://localhost:4566',
        S3_REGION: 'us-east-1',
        S3_BUCKET_NAME: 'local-bucket',
        SFN_ENDPOINT: 'http://localhost:8083',
        SFN_REGION: 'us-east-1',
        SFN_COMMAND_ARN:
          'arn:aws:states:us-east-1:000000000000:stateMachine:local-machine',
        SNS_ENDPOINT: 'http://localhost:4566',
        SNS_REGION: 'us-east-1',
        APPSYNC_ENDPOINT: 'http://localhost:20002',
        SES_ENDPOINT: 'http://localhost:8005',
        SES_REGION: 'us-east-1',
        SES_FROM_EMAIL: 'noreply@localhost',
        REQUEST_BODY_SIZE_LIMIT: '10mb',
      }

      const validate = getValidateConfig()

      expect(() => validate(localDevConfig)).not.toThrow()
    })
  })

  describe('Production Configuration', () => {
    it('should validate a minimal production configuration without optional endpoints', () => {
      const prodConfig = {
        NODE_ENV: 'prod',
        APP_NAME: 'production-app',
        EVENT_SOURCE_DISABLED: 'false',
        LOG_LEVEL: 'info',
        ATTRIBUTE_LIMIT_SIZE: '400000',
        S3_BUCKET_NAME: 'prod-bucket-12345',
        SFN_COMMAND_ARN:
          'arn:aws:states:ap-northeast-1:123456789012:stateMachine:prod-machine',
        SES_FROM_EMAIL: 'noreply@example.com',
      }

      const validate = getValidateConfig()

      expect(() => validate(prodConfig)).not.toThrow()
    })

    it('should validate production configuration with explicit regions but no endpoints', () => {
      const prodConfig = {
        NODE_ENV: 'prod',
        APP_NAME: 'production-app',
        EVENT_SOURCE_DISABLED: 'false',
        LOG_LEVEL: 'warn',
        DYNAMODB_REGION: 'ap-northeast-1',
        ATTRIBUTE_LIMIT_SIZE: '400000',
        S3_REGION: 'ap-northeast-1',
        S3_BUCKET_NAME: 'prod-bucket-12345',
        SFN_REGION: 'ap-northeast-1',
        SFN_COMMAND_ARN:
          'arn:aws:states:ap-northeast-1:123456789012:stateMachine:prod-machine',
        SNS_REGION: 'ap-northeast-1',
        SES_REGION: 'ap-northeast-1',
        SES_FROM_EMAIL: 'noreply@example.com',
      }

      const validate = getValidateConfig()

      expect(() => validate(prodConfig)).not.toThrow()
    })
  })

  describe('Error Messages', () => {
    it('should provide meaningful error when multiple required variables are missing', () => {
      const config = {
        NODE_ENV: 'local',
        // Missing: APP_NAME, EVENT_SOURCE_DISABLED, LOG_LEVEL, etc.
      }

      const validate = getValidateConfig()

      try {
        validate(config)
        fail('Expected validation to throw an error')
      } catch (error) {
        expect((error as Error).message).toContain('APP_NAME')
      }
    })

    it('should provide error for invalid enum value', () => {
      const config = createValidEnv({ NODE_ENV: 'development' }) // should be 'dev'

      const validate = getValidateConfig()

      try {
        validate(config)
        fail('Expected validation to throw an error')
      } catch (error) {
        expect((error as Error).message).toBeDefined()
      }
    })
  })

  describe('Environment Enum', () => {
    it('should have correct enum values', () => {
      expect(Environment.Local).toBe('local')
      expect(Environment.Development).toBe('dev')
      expect(Environment.Staging).toBe('stg')
      expect(Environment.Production).toBe('prod')
    })
  })

  describe('Deprecated Environment Variable Migration', () => {
    it('should migrate COGNITO_USER_POLL_CLIENT_ID to COGNITO_USER_POOL_CLIENT_ID', () => {
      const config = createValidEnv({
        COGNITO_USER_POLL_CLIENT_ID: 'test-client-id',
      })

      const validate = getValidateConfig()
      const result = validate(config)

      expect(
        (result as unknown as Record<string, unknown>)[
          'COGNITO_USER_POOL_CLIENT_ID'
        ],
      ).toBe('test-client-id')
    })

    it('should not overwrite COGNITO_USER_POOL_CLIENT_ID if already set', () => {
      const config = createValidEnv({
        COGNITO_USER_POLL_CLIENT_ID: 'old-value',
        COGNITO_USER_POOL_CLIENT_ID: 'new-value',
      })

      const validate = getValidateConfig()
      const result = validate(config)

      expect(
        (result as unknown as Record<string, unknown>)[
          'COGNITO_USER_POOL_CLIENT_ID'
        ],
      ).toBe('new-value')
    })

    it('should log a deprecation warning when migrating old variable name', () => {
      const config = createValidEnv({
        COGNITO_USER_POLL_CLIENT_ID: 'test-client-id',
      })

      const warnSpy = jest.spyOn(
        jest.requireActual('@nestjs/common').Logger.prototype,
        'warn',
      )

      const validate = getValidateConfig()
      validate(config)

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('COGNITO_USER_POLL_CLIENT_ID'),
      )

      warnSpy.mockRestore()
    })
  })

  describe('getValidateConfig Function', () => {
    it('should return a function', () => {
      const validate = getValidateConfig()
      expect(typeof validate).toBe('function')
    })

    it('should accept custom class constructor', () => {
      class CustomEnv extends EnvironmentVariables {}
      const validate = getValidateConfig(CustomEnv)
      expect(typeof validate).toBe('function')
    })

    it('should use EnvironmentVariables class by default when no class provided', () => {
      const config = createValidEnv()
      const validate = getValidateConfig()

      const result = validate(config)
      expect(result).toBeInstanceOf(EnvironmentVariables)
    })
  })
})
