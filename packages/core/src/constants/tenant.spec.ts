/**
 * Tests for tenant constants with environment variable configuration.
 *
 * Note: These tests use jest.isolateModules() to test different environment
 * variable configurations, as the constants are evaluated at module load time.
 */

describe('tenant constants', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('DEFAULT_COMMON_TENANT_CODES', () => {
    it('should default to ["common"] when COMMON_TENANT_CODES is not set', () => {
      delete process.env.COMMON_TENANT_CODES

      jest.isolateModules(() => {
        const { DEFAULT_COMMON_TENANT_CODES } = require('./tenant')
        expect(DEFAULT_COMMON_TENANT_CODES).toEqual(['common'])
      })
    })

    it('should parse single value from COMMON_TENANT_CODES', () => {
      process.env.COMMON_TENANT_CODES = 'shared'

      jest.isolateModules(() => {
        const { DEFAULT_COMMON_TENANT_CODES } = require('./tenant')
        expect(DEFAULT_COMMON_TENANT_CODES).toEqual(['shared'])
      })
    })

    it('should parse multiple comma-separated values from COMMON_TENANT_CODES', () => {
      process.env.COMMON_TENANT_CODES = 'common,shared,public'

      jest.isolateModules(() => {
        const { DEFAULT_COMMON_TENANT_CODES } = require('./tenant')
        expect(DEFAULT_COMMON_TENANT_CODES).toEqual(['common', 'shared', 'public'])
      })
    })

    it('should trim whitespace from COMMON_TENANT_CODES values', () => {
      process.env.COMMON_TENANT_CODES = ' common , shared , public '

      jest.isolateModules(() => {
        const { DEFAULT_COMMON_TENANT_CODES } = require('./tenant')
        expect(DEFAULT_COMMON_TENANT_CODES).toEqual(['common', 'shared', 'public'])
      })
    })

    it('should filter empty values from COMMON_TENANT_CODES', () => {
      process.env.COMMON_TENANT_CODES = 'common,,shared,,'

      jest.isolateModules(() => {
        const { DEFAULT_COMMON_TENANT_CODES } = require('./tenant')
        expect(DEFAULT_COMMON_TENANT_CODES).toEqual(['common', 'shared'])
      })
    })

    it('should fallback to default when COMMON_TENANT_CODES is empty string', () => {
      process.env.COMMON_TENANT_CODES = ''

      jest.isolateModules(() => {
        const { DEFAULT_COMMON_TENANT_CODES } = require('./tenant')
        // Empty string is falsy, so it falls back to default 'common'
        expect(DEFAULT_COMMON_TENANT_CODES).toEqual(['common'])
      })
    })
  })

  describe('DEFAULT_CROSS_TENANT_ROLES', () => {
    it('should default to ["system_admin"] when CROSS_TENANT_ROLES is not set', () => {
      delete process.env.CROSS_TENANT_ROLES

      jest.isolateModules(() => {
        const { DEFAULT_CROSS_TENANT_ROLES } = require('./tenant')
        expect(DEFAULT_CROSS_TENANT_ROLES).toEqual(['system_admin'])
      })
    })

    it('should parse single value from CROSS_TENANT_ROLES', () => {
      process.env.CROSS_TENANT_ROLES = 'admin'

      jest.isolateModules(() => {
        const { DEFAULT_CROSS_TENANT_ROLES } = require('./tenant')
        expect(DEFAULT_CROSS_TENANT_ROLES).toEqual(['admin'])
      })
    })

    it('should parse multiple comma-separated values from CROSS_TENANT_ROLES', () => {
      process.env.CROSS_TENANT_ROLES = 'system_admin,general_manager,super_admin'

      jest.isolateModules(() => {
        const { DEFAULT_CROSS_TENANT_ROLES } = require('./tenant')
        expect(DEFAULT_CROSS_TENANT_ROLES).toEqual([
          'system_admin',
          'general_manager',
          'super_admin',
        ])
      })
    })

    it('should trim whitespace from CROSS_TENANT_ROLES values', () => {
      process.env.CROSS_TENANT_ROLES = ' system_admin , general_manager '

      jest.isolateModules(() => {
        const { DEFAULT_CROSS_TENANT_ROLES } = require('./tenant')
        expect(DEFAULT_CROSS_TENANT_ROLES).toEqual(['system_admin', 'general_manager'])
      })
    })

    it('should filter empty values from CROSS_TENANT_ROLES', () => {
      process.env.CROSS_TENANT_ROLES = 'system_admin,,general_manager,,'

      jest.isolateModules(() => {
        const { DEFAULT_CROSS_TENANT_ROLES } = require('./tenant')
        expect(DEFAULT_CROSS_TENANT_ROLES).toEqual(['system_admin', 'general_manager'])
      })
    })

    it('should fallback to default when CROSS_TENANT_ROLES is empty string', () => {
      process.env.CROSS_TENANT_ROLES = ''

      jest.isolateModules(() => {
        const { DEFAULT_CROSS_TENANT_ROLES } = require('./tenant')
        // Empty string is falsy, so it falls back to default 'system_admin'
        expect(DEFAULT_CROSS_TENANT_ROLES).toEqual(['system_admin'])
      })
    })
  })

  describe('TENANT_COMMON (deprecated)', () => {
    it('should default to "common" when COMMON_TENANT_CODES is not set', () => {
      delete process.env.COMMON_TENANT_CODES

      jest.isolateModules(() => {
        const { TENANT_COMMON } = require('./tenant')
        expect(TENANT_COMMON).toBe('common')
      })
    })

    it('should use first value from COMMON_TENANT_CODES', () => {
      process.env.COMMON_TENANT_CODES = 'shared,public,common'

      jest.isolateModules(() => {
        const { TENANT_COMMON } = require('./tenant')
        expect(TENANT_COMMON).toBe('shared')
      })
    })

    it('should trim whitespace from first value', () => {
      process.env.COMMON_TENANT_CODES = ' shared , public '

      jest.isolateModules(() => {
        const { TENANT_COMMON } = require('./tenant')
        expect(TENANT_COMMON).toBe('shared')
      })
    })

    it('should fallback to "common" when COMMON_TENANT_CODES is empty', () => {
      process.env.COMMON_TENANT_CODES = ''

      jest.isolateModules(() => {
        const { TENANT_COMMON } = require('./tenant')
        expect(TENANT_COMMON).toBe('common')
      })
    })
  })

  describe('other constants', () => {
    it('should export HEADER_TENANT_CODE', () => {
      jest.isolateModules(() => {
        const { HEADER_TENANT_CODE } = require('./tenant')
        expect(HEADER_TENANT_CODE).toBe('x-tenant-code')
      })
    })

    it('should export DEFAULT_TENANT_CODE', () => {
      jest.isolateModules(() => {
        const { DEFAULT_TENANT_CODE } = require('./tenant')
        expect(DEFAULT_TENANT_CODE).toBe('single')
      })
    })
  })
})
