const mockConsoleInfo = jest.fn()
const originalConsoleInfo = console.info
console.info = mockConsoleInfo

import { Test, TestingModule } from '@nestjs/testing'
import { ConsoleLogger } from '@nestjs/common'
import { getLogLevels, RequestLogger } from './request-logger.service'

jest.mock('../helpers', () => ({
  IS_LAMBDA_RUNNING: false
}))

jest.mock('../context', () => ({
  extractInvokeContext: jest.fn(() => ({
    event: {
      requestContext: {
        http: {
          sourceIp: '127.0.0.1'
        }
      }
    },
    context: {
      awsRequestId: 'test-request-id'
    }
  }))
}))

jest.mock('../context/user', () => ({
  getUserContext: jest.fn(() => ({
    tenantCode: 'test-tenant',
    userId: 'test-user'
  }))
}))

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
  const mockExtractInvokeContext = require('../context').extractInvokeContext as jest.Mock
  const mockGetUserContext = require('../context/user').getUserContext as jest.Mock

  afterAll(() => {
    // Restore original console.info
    console.info = originalConsoleInfo
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    
    mockExtractInvokeContext.mockReturnValue({
      context: { awsRequestId: 'test-request-id' },
      event: { requestContext: { http: { sourceIp: '127.0.0.1' } } }
    })
    
    mockGetUserContext.mockReturnValue({
      tenantCode: 'test-tenant',
      userId: 'test-user'
    })

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
      const originalNodeEnv = process.env.NODE_ENV
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-lambda'
      process.env.NODE_ENV = 'production'
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      const error = new Error('Lambda error')
      
      const mockHelpers = require('../helpers')
      mockHelpers.IS_LAMBDA_RUNNING = true

      const newService = new RequestLogger()
      newService['printStackTrace'](error.stack || '')

      expect(consoleErrorSpy).toHaveBeenCalledWith(error.stack)

      consoleErrorSpy.mockRestore()
      mockHelpers.IS_LAMBDA_RUNNING = false
      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      } else {
        delete process.env.AWS_LAMBDA_FUNCTION_NAME
      }
      if (originalNodeEnv) {
        process.env.NODE_ENV = originalNodeEnv
      } else {
        delete process.env.NODE_ENV
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

      service['printMessages'](messages, context, 'log')

      expect(superSpy).toHaveBeenCalledWith(messages, context, 'log', undefined)

      superSpy.mockRestore()
      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      }
    })

    it('should print messages with context in Lambda environment', () => {
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME
      const originalNodeEnv = process.env.NODE_ENV
      
      const mockHelpers = require('../helpers')
      const originalIsLambda = mockHelpers.IS_LAMBDA_RUNNING
      
      mockConsoleInfo.mockClear()
      
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-lambda'
      process.env.NODE_ENV = 'production'
      mockHelpers.IS_LAMBDA_RUNNING = true
      
      const messages = ['Lambda Message 1', 'Lambda Message 2']
      const context = 'LambdaContext'

      const newService = new RequestLogger()
      newService['printMessages'](messages, context, 'log')

      expect(mockConsoleInfo).toHaveBeenCalledTimes(2)
      expect(mockConsoleInfo).toHaveBeenCalledWith({
        context: 'LambdaContext',
        requestId: 'test-request-id',
        ip: '127.0.0.1',
        tenantCode: 'test-tenant',
        userId: 'test-user',
        message: 'Lambda Message 1'
      })
      expect(mockConsoleInfo).toHaveBeenCalledWith({
        context: 'LambdaContext',
        requestId: 'test-request-id',
        ip: '127.0.0.1',
        tenantCode: 'test-tenant',
        userId: 'test-user',
        message: 'Lambda Message 2'
      })
      
      mockHelpers.IS_LAMBDA_RUNNING = originalIsLambda
      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      } else {
        delete process.env.AWS_LAMBDA_FUNCTION_NAME
      }
      if (originalNodeEnv) {
        process.env.NODE_ENV = originalNodeEnv
      } else {
        delete process.env.NODE_ENV
      }
    })

    it('should handle empty messages array', () => {
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME
      const originalNodeEnv = process.env.NODE_ENV
      
      const mockHelpers = require('../helpers')
      const originalIsLambda = mockHelpers.IS_LAMBDA_RUNNING
      
      delete process.env.AWS_LAMBDA_FUNCTION_NAME
      process.env.NODE_ENV = 'Local'
      mockHelpers.IS_LAMBDA_RUNNING = false
      
      const superSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(service)), 'printMessages').mockImplementation()
      const newService = new RequestLogger()

      const messages: string[] = []
      const context = 'EmptyContext'

      newService['printMessages'](messages, context, 'log')

      expect(superSpy).toHaveBeenCalledWith([], context, 'log', undefined)

      superSpy.mockRestore()
      mockHelpers.IS_LAMBDA_RUNNING = originalIsLambda
      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      }
      if (originalNodeEnv) {
        process.env.NODE_ENV = originalNodeEnv
      } else {
        delete process.env.NODE_ENV
      }
    })

    it('should handle single message', () => {
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME
      const originalNodeEnv = process.env.NODE_ENV
      
      const mockHelpers = require('../helpers')
      const originalIsLambda = mockHelpers.IS_LAMBDA_RUNNING
      
      delete process.env.AWS_LAMBDA_FUNCTION_NAME
      process.env.NODE_ENV = 'Local'
      mockHelpers.IS_LAMBDA_RUNNING = false
      
      const superSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(service)), 'printMessages').mockImplementation()
      const newService = new RequestLogger()

      const messages = ['Single message']
      const context = 'SingleContext'

      newService['printMessages'](messages, context, 'log')

      expect(superSpy).toHaveBeenCalledWith(messages, context, 'log', undefined)

      superSpy.mockRestore()
      mockHelpers.IS_LAMBDA_RUNNING = originalIsLambda
      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      }
      if (originalNodeEnv) {
        process.env.NODE_ENV = originalNodeEnv
      } else {
        delete process.env.NODE_ENV
      }
    })

    it('should handle messages with special characters', () => {
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME
      const originalNodeEnv = process.env.NODE_ENV
      
      const mockHelpers = require('../helpers')
      const originalIsLambda = mockHelpers.IS_LAMBDA_RUNNING
      
      delete process.env.AWS_LAMBDA_FUNCTION_NAME
      process.env.NODE_ENV = 'Local'
      mockHelpers.IS_LAMBDA_RUNNING = false
      
      const superSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(service)), 'printMessages').mockImplementation()
      const newService = new RequestLogger()

      const messages = ['Message with 🚀 unicode', 'Message with "quotes"', 'Message with \n newlines']
      const context = 'SpecialContext'

      newService['printMessages'](messages, context, 'log')

      expect(superSpy).toHaveBeenCalledWith(messages, context, 'log', undefined)

      superSpy.mockRestore()
      mockHelpers.IS_LAMBDA_RUNNING = originalIsLambda
      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      }
      if (originalNodeEnv) {
        process.env.NODE_ENV = originalNodeEnv
      } else {
        delete process.env.NODE_ENV
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

    it('should return context message in local environment', () => {
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
      expect(result.context).toBe('test-context')

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

      const result = service['getLambdaContextMessage'](null as any)

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
      const originalNodeEnv = process.env.NODE_ENV
      
      const mockHelpers = require('../helpers')
      const originalIsLambda = mockHelpers.IS_LAMBDA_RUNNING
      
      delete process.env.AWS_LAMBDA_FUNCTION_NAME
      process.env.NODE_ENV = 'Local'
      mockHelpers.IS_LAMBDA_RUNNING = false
      
      const superSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(service)), 'printMessages').mockImplementation()
      const newService = new RequestLogger()

      const messages = ['Regular message']
      const context = 'RegularContext'

      newService['printMessages'](messages, context, 'log')

      expect(superSpy).toHaveBeenCalledWith(messages, context, 'log', undefined)

      superSpy.mockRestore()
      mockHelpers.IS_LAMBDA_RUNNING = originalIsLambda
      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      }
      if (originalNodeEnv) {
        process.env.NODE_ENV = originalNodeEnv
      } else {
        delete process.env.NODE_ENV
      }
    })

    it('should handle case-sensitive filtering', () => {
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME
      const originalNodeEnv = process.env.NODE_ENV
      
      const mockHelpers = require('../helpers')
      const originalIsLambda = mockHelpers.IS_LAMBDA_RUNNING
      
      delete process.env.AWS_LAMBDA_FUNCTION_NAME
      process.env.NODE_ENV = 'Local'
      mockHelpers.IS_LAMBDA_RUNNING = false
      
      const superSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(service)), 'printMessages').mockImplementation()
      const newService = new RequestLogger()

      const messages = ['Case test']
      const context = 'instanceloader'

      newService['printMessages'](messages, context, 'log')

      expect(superSpy).toHaveBeenCalledWith(messages, context, 'log', undefined)

      superSpy.mockRestore()
      mockHelpers.IS_LAMBDA_RUNNING = originalIsLambda
      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      }
      if (originalNodeEnv) {
        process.env.NODE_ENV = originalNodeEnv
      } else {
        delete process.env.NODE_ENV
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
      const originalNodeEnv = process.env.NODE_ENV
      delete process.env.AWS_LAMBDA_FUNCTION_NAME
      process.env.NODE_ENV = 'Local'
      
      const superSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(service)), 'printStackTrace').mockImplementation()
      const error = new Error('Local error')

      const mockHelpers = require('../helpers')
      const originalIsLambda = mockHelpers.IS_LAMBDA_RUNNING
      mockHelpers.IS_LAMBDA_RUNNING = false

      const newService = new RequestLogger()
      newService['printStackTrace'](error.stack || '')

      expect(superSpy).toHaveBeenCalledWith(error.stack)

      superSpy.mockRestore()
      mockHelpers.IS_LAMBDA_RUNNING = originalIsLambda
      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      }
      if (originalNodeEnv) {
        process.env.NODE_ENV = originalNodeEnv
      } else {
        delete process.env.NODE_ENV
      }
    })

    it('should detect Lambda environment correctly', () => {
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME
      const originalNodeEnv = process.env.NODE_ENV
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-lambda-function'
      process.env.NODE_ENV = 'production'
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const error = new Error('Lambda error')

      const mockHelpers = require('../helpers')
      mockHelpers.IS_LAMBDA_RUNNING = true

      const newService = new RequestLogger()
      newService['printStackTrace'](error.stack || '')

      expect(consoleSpy).toHaveBeenCalledWith(error.stack)

      consoleSpy.mockRestore()
      mockHelpers.IS_LAMBDA_RUNNING = false
      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      } else {
        delete process.env.AWS_LAMBDA_FUNCTION_NAME
      }
      if (originalNodeEnv) {
        process.env.NODE_ENV = originalNodeEnv
      } else {
        delete process.env.NODE_ENV
      }
    })

    it('should handle environment variable changes during execution', () => {
      const originalNodeEnv = process.env.NODE_ENV
      const originalEnv = process.env.AWS_LAMBDA_FUNCTION_NAME
      
      const mockHelpers = require('../helpers')
      const originalIsLambda = mockHelpers.IS_LAMBDA_RUNNING
      
      mockConsoleInfo.mockClear()
      
      const superSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(service)), 'printMessages').mockImplementation()
      
      mockHelpers.IS_LAMBDA_RUNNING = true
      process.env.NODE_ENV = 'production'
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'test-lambda'
      
      const lambdaService = new RequestLogger()
      lambdaService['printMessages'](['Lambda message'], 'LambdaContext', 'log')
      
      mockHelpers.IS_LAMBDA_RUNNING = false
      process.env.NODE_ENV = 'Local'
      delete process.env.AWS_LAMBDA_FUNCTION_NAME
      
      const localService = new RequestLogger()
      localService['printMessages'](['Local message'], 'LocalContext', 'log')
      
      expect(mockConsoleInfo).toHaveBeenCalledWith({
        context: 'LambdaContext',
        requestId: 'test-request-id',
        ip: '127.0.0.1',
        tenantCode: 'test-tenant',
        userId: 'test-user',
        message: 'Lambda message'
      })
      expect(superSpy).toHaveBeenCalledWith(['Local message'], 'LocalContext', 'log', undefined)

      superSpy.mockRestore()
      mockHelpers.IS_LAMBDA_RUNNING = originalIsLambda
      if (originalNodeEnv) {
        process.env.NODE_ENV = originalNodeEnv
      } else {
        delete process.env.NODE_ENV
      }
      if (originalEnv) {
        process.env.AWS_LAMBDA_FUNCTION_NAME = originalEnv
      }
    })
  })
})
