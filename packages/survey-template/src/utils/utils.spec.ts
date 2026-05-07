import { getOrderBy, getOrderBys, parsePk, SortOrder } from './index'

describe('Survey Template Utils', () => {
  describe('parsePk', () => {
    it('should parse valid pk with two parts', () => {
      const result = parsePk('SURVEY#test-tenant')

      expect(result).toEqual({
        type: 'SURVEY',
        tenantCode: 'test-tenant',
      })
    })

    it('should throw error for pk with less than two parts', () => {
      expect(() => parsePk('SURVEY')).toThrow('Invalid PK')
    })

    it('should throw error for pk with more than two parts', () => {
      expect(() => parsePk('SURVEY#test-tenant#extra')).toThrow('Invalid PK')
    })

    it('should handle different types', () => {
      const result = parsePk('MASTER#tenant-123')

      expect(result).toEqual({
        type: 'MASTER',
        tenantCode: 'tenant-123',
      })
    })

    it('should handle tenant codes with special characters', () => {
      const result = parsePk('SURVEY#tenant_with_underscore')

      expect(result).toEqual({
        type: 'SURVEY',
        tenantCode: 'tenant_with_underscore',
      })
    })
  })

  describe('getOrderBy', () => {
    it('should return ascending order for plain field name', () => {
      const result = getOrderBy('name')

      expect(result).toEqual({ name: SortOrder.asc })
    })

    it('should return descending order for field prefixed with -', () => {
      const result = getOrderBy('-createdAt')

      expect(result).toEqual({ createdAt: SortOrder.desc })
    })

    it('should handle different field names', () => {
      expect(getOrderBy('updatedAt')).toEqual({ updatedAt: SortOrder.asc })
      expect(getOrderBy('-version')).toEqual({ version: SortOrder.desc })
      expect(getOrderBy('id')).toEqual({ id: SortOrder.asc })
    })
  })

  describe('getOrderBys', () => {
    it('should convert array of order strings', () => {
      const result = getOrderBys(['name', '-createdAt', 'version'])

      expect(result).toEqual([
        { name: SortOrder.asc },
        { createdAt: SortOrder.desc },
        { version: SortOrder.asc },
      ])
    })

    it('should return undefined for undefined input', () => {
      const result = getOrderBys(undefined as any)

      expect(result).toBeUndefined()
    })

    it('should handle empty array', () => {
      const result = getOrderBys([])

      expect(result).toEqual([])
    })

    it('should handle single item array', () => {
      const result = getOrderBys(['-updatedAt'])

      expect(result).toEqual([{ updatedAt: SortOrder.desc }])
    })
  })

  describe('SortOrder enum', () => {
    it('should have correct values', () => {
      expect(SortOrder.asc).toBe('asc')
      expect(SortOrder.desc).toBe('desc')
    })
  })
})
