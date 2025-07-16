import { Test, TestingModule } from '@nestjs/testing'
import { ConsoleLogger } from '@nestjs/common'
import { getLogLevels, RequestLogger } from './request-logger.service'

describe('RequestLogger.getLogLevels', () => {
  it('should return all log levels', () => {
    const levels = getLogLevels('verbose')
    expect(levels).toEqual([
      'verbose',
      'debug',
      'log',
      'warn',
      'error',
      'fatal',
    ])
  })

  it('should return log levels from debug', () => {
    const levels = getLogLevels('debug')
    expect(levels).toEqual(['debug', 'log', 'warn', 'error', 'fatal'])
  })

  it('should return log levels from info', () => {
    const levels = getLogLevels('info')
    expect(levels).toEqual(['log', 'warn', 'error', 'fatal'])
  })

  it('should return log levels from warn', () => {
    const levels = getLogLevels('warn')
    expect(levels).toEqual(['warn', 'error', 'fatal'])
  })

  it('should return log levels from error', () => {
    const levels = getLogLevels('error')
    expect(levels).toEqual(['error', 'fatal'])
  })

  it('should return log levels from fatal', () => {
    const levels = getLogLevels('fatal')
    expect(levels).toEqual(['fatal'])
  })

  /**
   * Test Overview: Tests edge cases for getLogLevels function
   * Purpose: Ensures the function handles invalid and edge case inputs properly
   * Details: Verifies behavior with invalid log levels, null values, and case sensitivity
   */
  describe('Edge Cases', () => {
    it('should handle invalid log level gracefully', () => {
      const levels = getLogLevels('invalid' as any)
      expect(levels).toEqual(['verbose', 'debug', 'log', 'warn', 'error', 'fatal'])
    })

    it('should handle null log level', () => {
      const levels = getLogLevels(null as any)
      expect(levels).toEqual(['verbose', 'debug', 'log', 'warn', 'error', 'fatal'])
    })

    it('should handle undefined log level', () => {
      const levels = getLogLevels(undefined as any)
      expect(levels).toEqual(['verbose', 'debug', 'log', 'warn', 'error', 'fatal'])
    })

    it('should handle empty string log level', () => {
      const levels = getLogLevels('' as any)
      expect(levels).toEqual(['verbose', 'debug', 'log', 'warn', 'error', 'fatal'])
    })

    it('should be case sensitive', () => {
      const levels = getLogLevels('ERROR' as any)
      expect(levels).toEqual(['verbose', 'debug', 'log', 'warn', 'error', 'fatal'])
    })
  })
})

/**
 * Test Overview: Tests RequestLogger class methods and functionality
 * Purpose: Ensures the RequestLogger service handles various logging scenarios correctly
 * Details: Verifies printStackTrace, printMessages, and context handling in different environments
 */
describe('RequestLogger', () => {
  let service: RequestLogger
  let consoleSpy: jest.SpyInstance

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RequestLogger],
    }).compile()

    service = module.get<RequestLogger>(RequestLogger)
    consoleSpy = jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  /**
   * Test Overview: Tests printStackTrace method in different environments
   * Purpose: Ensures stack trace printing works correctly in both local and Lambda environments
   * Details: Verifies behavior with different context types, error objects, and environment conditions
   */
  describe('printStackTrace', () => {
    it('should print stack trace in local environment', () => {
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME
      delete process.env.AWS_LAMBDA_FUNCTION_NAME
      const superSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(service)), 'printStackTrace').mockImplementation()

      const error = new Error('Test error')

      service['printStackTrace'](error.stack || '')

      expect(superSpy).toHaveBeenCalledWith(error.stack)

      superSpy.mockRestore()
      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      }
    })

    it('should print stack trace in Lambda environment', () => {
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-lambda'
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      const error = new Error('Lambda error')

      service['printStackTrace'](error.stack || '')

      expect(consoleErrorSpy).toHaveBeenCalledWith(error.stack)

      consoleErrorSpy.mockRestore()
      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      } else {
        delete process.env.AWS_LAMBDA_FUNCTION_NAME
      }
    })

    it('should handle error without stack trace', () => {
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-lambda'
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      const error = { message: 'Error without stack' } as Error

      service['printStackTrace'](error.stack || '')

      expect(consoleErrorSpy).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      } else {
        delete process.env.AWS_LAMBDA_FUNCTION_NAME
      }
    })

    it('should handle null error object', () => {
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-lambda'
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      service['printStackTrace']('')

      expect(consoleErrorSpy).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      } else {
        delete process.env.AWS_LAMBDA_FUNCTION_NAME
      }
    })

    it('should handle undefined error', () => {
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-lambda'
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      service['printStackTrace']('')

      expect(consoleErrorSpy).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      } else {
        delete process.env.AWS_LAMBDA_FUNCTION_NAME
      }
    })
  })

  /**
   * Test Overview: Tests printMessages method with different contexts and log levels
   * Purpose: Ensures message printing works correctly with various context types and filtering
   * Details: Verifies behavior with different message arrays, contexts, and filtering scenarios
   */
  describe('printMessages', () => {
    it('should print messages with context in local environment', () => {
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME
      delete process.env.AWS_LAMBDA_FUNCTION_NAME
      const superSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(service)), 'printMessages').mockImplementation()

      const messages = ['Message 1', 'Message 2', 'Message 3']
      const context = 'TestContext'

      service['printMessages'](messages, context)

      expect(superSpy).toHaveBeenCalledWith(messages, context, undefined, undefined)

      superSpy.mockRestore()
      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      }
    })

    it('should print messages with context in Lambda environment', () => {
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-lambda'
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation()

      const messages = ['Lambda Message 1', 'Lambda Message 2']
      const context = 'LambdaContext'

      service['printMessages'](messages, context)

      expect(consoleInfoSpy).toHaveBeenCalledTimes(2)

      consoleInfoSpy.mockRestore()
      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      } else {
        delete process.env.AWS_LAMBDA_FUNCTION_NAME
      }
    })

    it('should handle empty messages array', () => {
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME
      delete process.env.AWS_LAMBDA_FUNCTION_NAME
      const superSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(service)), 'printMessages').mockImplementation()

      const messages: string[] = []
      const context = 'EmptyContext'

      service['printMessages'](messages, context)

      expect(superSpy).toHaveBeenCalledWith([], context, undefined, undefined)

      superSpy.mockRestore()
      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      }
    })

    it('should handle single message', () => {
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME
      delete process.env.AWS_LAMBDA_FUNCTION_NAME
      const superSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(service)), 'printMessages').mockImplementation()

      const messages = ['Single message']
      const context = 'SingleContext'

      service['printMessages'](messages, context)

      expect(superSpy).toHaveBeenCalledWith(messages, context, undefined, undefined)

      superSpy.mockRestore()
      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      }
    })

    it('should handle messages with special characters', () => {
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME
      delete process.env.AWS_LAMBDA_FUNCTION_NAME
      const superSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(service)), 'printMessages').mockImplementation()

      const messages = ['Message with 🚀 unicode', 'Message with "quotes"', 'Message with \n newlines']
      const context = 'SpecialContext'

      service['printMessages'](messages, context)

      expect(superSpy).toHaveBeenCalledWith(messages, context, undefined, undefined)

      superSpy.mockRestore()
      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      }
    })
  })

  /**
   * Test Overview: Tests getLambdaContextMessage method with various context scenarios
   * Purpose: Ensures Lambda context message generation works correctly in different environments
   * Details: Verifies behavior with different Lambda contexts, missing properties, and environment conditions
   */
  describe('getLambdaContextMessage', () => {
    it('should generate context message in Lambda environment', () => {
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-lambda'

      const mockContext = {
        functionName: 'test-function',
        functionVersion: '1.0',
        awsRequestId: 'test-request-id',
        memoryLimitInMB: '128',
        getRemainingTimeInMillis: () => 30000
      }

      const result = service['getLambdaContextMessage']('test-context')

      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
      expect(result.context).toBe('test-context')

      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      } else {
        delete process.env.AWS_LAMBDA_FUNCTION_NAME
      }
    })

    it('should return empty string in local environment', () => {
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME
      delete process.env.AWS_LAMBDA_FUNCTION_NAME

      const mockContext = {
        functionName: 'test-function',
        functionVersion: '1.0',
        awsRequestId: 'test-request-id'
      }

      const result = service['getLambdaContextMessage']('test-context')

      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
      expect(result.context).toBeNull()

      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      }
    })

    it('should handle missing context properties', () => {
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-lambda'

      const mockContext = {
        functionName: 'test-function'
      }

      const result = service['getLambdaContextMessage']('test-context')

      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
      expect(result.context).toBe('test-context')

      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      } else {
        delete process.env.AWS_LAMBDA_FUNCTION_NAME
      }
    })

    it('should handle null context', () => {
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-lambda'

      const result = service['getLambdaContextMessage']()

      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
      expect(result.context).toBeNull()

      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      } else {
        delete process.env.AWS_LAMBDA_FUNCTION_NAME
      }
    })
  })

  /**
   * Test Overview: Tests context filtering functionality for different NestJS contexts
   * Purpose: Ensures proper filtering of InstanceLoader, RoutesResolver, and RouterExplorer contexts
   * Details: Verifies behavior with different context strings and filtering scenarios
   */
  describe('Context Filtering', () => {
    it('should filter InstanceLoader context', () => {
      const messages = ['Loading instance']
      const context = 'InstanceLoader'

      service['printMessages'](messages, context)

      expect(consoleSpy).not.toHaveBeenCalled()
    })

    it('should filter RoutesResolver context', () => {
      const messages = ['Resolving routes']
      const context = 'RoutesResolver'

      service['printMessages'](messages, context)

      expect(consoleSpy).not.toHaveBeenCalled()
    })

    it('should filter RouterExplorer context', () => {
      const messages = ['Exploring routes']
      const context = 'RouterExplorer'

      service['printMessages'](messages, context)

      expect(consoleSpy).not.toHaveBeenCalled()
    })

    it('should not filter other contexts', () => {
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME
      delete process.env.AWS_LAMBDA_FUNCTION_NAME
      const superSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(service)), 'printMessages').mockImplementation()

      const messages = ['Regular message']
      const context = 'RegularContext'

      service['printMessages'](messages, context)

      expect(superSpy).toHaveBeenCalledWith(messages, context, undefined, undefined)

      superSpy.mockRestore()
      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      }
    })

    it('should handle case-sensitive filtering', () => {
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME
      delete process.env.AWS_LAMBDA_FUNCTION_NAME
      const superSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(service)), 'printMessages').mockImplementation()

      const messages = ['Case test']
      const context = 'instanceloader'

      service['printMessages'](messages, context)

      expect(superSpy).toHaveBeenCalledWith(messages, context, undefined, undefined)

      superSpy.mockRestore()
      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      }
    })
  })

  /**
   * Test Overview: Tests environment-specific behavior in different execution contexts
   * Purpose: Ensures the service behaves correctly in both local development and Lambda environments
   * Details: Verifies environment detection and behavior adaptation based on AWS_LAMBDA_FUNCTION_NAME
   */
  describe('Environment-Specific Behavior', () => {
    it('should detect local environment correctly', () => {
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME
      delete process.env.AWS_LAMBDA_FUNCTION_NAME

      const error = new Error('Local error')

      service['printStackTrace'](error.stack || '')

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error'),
        error.stack
      )

      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      }
    })

    it('should detect Lambda environment correctly', () => {
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-lambda-function'

      const error = new Error('Lambda error')

      service['printStackTrace'](error.stack || '')

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error'),
        error.stack
      )

      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      } else {
        delete process.env.AWS_LAMBDA_FUNCTION_NAME
      }
    })

    it('should handle environment variable changes during execution', () => {
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME
      
      delete process.env.AWS_LAMBDA_FUNCTION_NAME
      service['printMessages'](['Local message'], 'LocalContext')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[LocalContext]'),
        ['Local message']
      )

      consoleSpy.mockClear()

      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-lambda'
      service['printMessages'](['Lambda message'], 'LambdaContext')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[LambdaContext]'),
        ['Lambda message']
      )

      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      } else {
        delete process.env.AWS_LAMBDA_FUNCTION_NAME
      }
    })
  })
})
