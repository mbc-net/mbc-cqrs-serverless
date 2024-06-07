import { getLogLevels } from './request-logger.service'

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
})
