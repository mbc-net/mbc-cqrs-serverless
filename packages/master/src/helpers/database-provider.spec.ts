import { Logger } from '@nestjs/common'

import {
  containsInsensitive,
  jsonPath,
  resolveDatabaseProvider,
} from './database-provider'

describe('database provider helpers', () => {
  afterEach(() => jest.restoreAllMocks())

  describe('resolveDatabaseProvider', () => {
    it('reads the provider the Prisma client was generated for', () => {
      expect(resolveDatabaseProvider({ _activeProvider: 'mysql' })).toBe(
        'mysql',
      )
      expect(resolveDatabaseProvider({ _activeProvider: 'postgresql' })).toBe(
        'postgresql',
      )
    })

    it('lets the override win over detection', () => {
      expect(
        resolveDatabaseProvider({ _activeProvider: 'postgresql' }, 'mysql'),
      ).toBe('mysql')
    })

    it('falls back to postgresql and warns when the provider is unknown', () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation()
      expect(resolveDatabaseProvider({})).toBe('postgresql')
      expect(resolveDatabaseProvider({ _activeProvider: 'sqlite' })).toBe(
        'postgresql',
      )
      expect(resolveDatabaseProvider(undefined)).toBe('postgresql')
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('databaseProvider'),
      )
    })
  })

  describe('containsInsensitive', () => {
    it('uses mode insensitive on postgresql', () => {
      expect(containsInsensitive('abc', 'postgresql')).toEqual({
        contains: 'abc',
        mode: 'insensitive',
      })
    })

    it('omits mode on mysql, whose default collation ignores case', () => {
      expect(containsInsensitive('abc', 'mysql')).toEqual({ contains: 'abc' })
    })
  })

  describe('jsonPath', () => {
    it('uses an array path on postgresql', () => {
      expect(jsonPath('description', 'postgresql')).toEqual(['description'])
    })

    it('uses a JSON path string on mysql', () => {
      expect(jsonPath('description', 'mysql')).toBe('$.description')
    })
  })
})
