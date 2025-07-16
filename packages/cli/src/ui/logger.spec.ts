import { logger } from './logger'

describe('Logger Utilities', () => {
  let originalConsole: typeof console

  beforeEach(() => {
    originalConsole = { ...console }
    console.info = jest.fn()
    console.log = jest.fn()
    console.error = jest.fn()
    console.warn = jest.fn()
  })

  afterEach(() => {
    console.info = originalConsole.info
    console.log = originalConsole.log
    console.error = originalConsole.error
    console.warn = originalConsole.warn
  })

  describe('Overview: CLI logging functionality', () => {
    describe('Purpose: Test info logging methods', () => {
      it('should log info messages with proper formatting', () => {
        logger.info('Test info message')

        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Test info message')
        )
      })

      it('should handle multiple info messages', () => {
        logger.info('First message')
        logger.info('Second message')

        expect(console.log).toHaveBeenCalledTimes(2)
        expect(console.log).toHaveBeenNthCalledWith(1, expect.stringContaining('First message'))
        expect(console.log).toHaveBeenNthCalledWith(2, expect.stringContaining('Second message'))
      })

      it('should handle empty info messages', () => {
        logger.info('')

        expect(console.log).toHaveBeenCalledWith(expect.any(String))
      })
    })

    describe('Purpose: Test error logging methods', () => {
      it('should log error messages with proper formatting', () => {
        logger.error('Test error message')

        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('Test error message')
        )
      })

      it('should handle error objects', () => {
        const error = new Error('Test error')
        logger.error(error.message)

        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('Test error')
        )
      })

      it('should handle multiple error messages', () => {
        logger.error('First error')
        logger.error('Second error')

        expect(console.error).toHaveBeenCalledTimes(2)
      })
    })

    describe('Purpose: Test warning logging methods', () => {
      it('should log warning messages with proper formatting', () => {
        logger.warn('Test warning message')

        expect(console.warn).toHaveBeenCalledWith(
          expect.stringContaining('Test warning message')
        )
      })

      it('should handle multiple warning messages', () => {
        logger.warn('First warning')
        logger.warn('Second warning')

        expect(console.warn).toHaveBeenCalledTimes(2)
      })
    })

    describe('Purpose: Test success and status logging methods', () => {
      it('should log success messages with proper formatting', () => {
        logger.success('Operation completed successfully')

        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Operation completed successfully')
        )
      })

      it('should log title messages with proper formatting', () => {
        logger.title('test', 'Processing...')

        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Processing...')
        )
      })
    })

    describe('Purpose: Test message formatting and special characters', () => {
      it('should handle messages with special characters', () => {
        const specialMessage = 'Message with @#$%^&*() characters'
        logger.info(specialMessage)

        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining(specialMessage)
        )
      })

      it('should handle messages with newlines', () => {
        const multilineMessage = 'Line 1\nLine 2\nLine 3'
        logger.info(multilineMessage)

        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining(multilineMessage)
        )
      })

      it('should handle very long messages', () => {
        const longMessage = 'A'.repeat(1000)
        logger.info(longMessage)

        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining(longMessage)
        )
      })
    })

    describe('Purpose: Test logging with different data types', () => {
      it('should handle string conversion of undefined messages', () => {
        logger.info(String(undefined))

        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('undefined')
        )
      })

      it('should handle string conversion of null messages', () => {
        logger.info(String(null))

        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('null')
        )
      })

      it('should handle string conversion of numeric messages', () => {
        logger.info(String(123))

        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('123')
        )
      })

      it('should handle string conversion of boolean messages', () => {
        logger.info(String(true))

        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('true')
        )
      })
    })

    describe('Purpose: Test concurrent logging scenarios', () => {
      it('should handle multiple concurrent log calls', () => {
        const promises = [
          Promise.resolve(logger.info('Concurrent message 1')),
          Promise.resolve(logger.error('Concurrent error 1')),
          Promise.resolve(logger.warn('Concurrent warning 1')),
          Promise.resolve(logger.success('Concurrent success 1'))
        ]

        return Promise.all(promises).then(() => {
          expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Concurrent message 1'))
          expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Concurrent error 1'))
          expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Concurrent warning 1'))
          expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Concurrent success 1'))
        })
      })

      it('should maintain message order in rapid succession', () => {
        logger.info('Message 1')
        logger.info('Message 2')
        logger.info('Message 3')

        expect(console.log).toHaveBeenCalledTimes(3)
        expect(console.log).toHaveBeenNthCalledWith(1, expect.stringContaining('Message 1'))
        expect(console.log).toHaveBeenNthCalledWith(2, expect.stringContaining('Message 2'))
        expect(console.log).toHaveBeenNthCalledWith(3, expect.stringContaining('Message 3'))
      })
    })

    describe('Purpose: Test error handling in logging methods', () => {
      it('should handle console method failures gracefully', () => {
        console.log = jest.fn().mockImplementation(() => {
          throw new Error('Console error')
        })

        expect(() => logger.info('Test message')).toThrow('Console error')
      })

      it('should handle console method unavailability', () => {
        const originalLog = console.log
        delete (console as any).log

        expect(() => logger.info('Test message')).not.toThrow()

        console.log = originalLog
      })
    })
  })
})
