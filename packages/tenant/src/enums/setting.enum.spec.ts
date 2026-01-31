/**
 * SettingTypeEnum Test Suite
 *
 * Validates the enum values for tenant settings.
 * These tests ensure that the enum values remain consistent
 * as they are used in partition key generation and data operations.
 *
 * IMPORTANT: TENANT_COMMON = 'common' (lowercase) is critical for:
 * - Partition key format: TENANT#common
 * - Case-insensitive tenant code matching
 * - Backward compatibility with existing data
 */
import { SettingTypeEnum } from './setting.enum'

describe('SettingTypeEnum', () => {
  /**
   * Tests for TENANT_COMMON enum value
   * Critical: This value is used in PK generation and must be lowercase 'common'
   */
  describe('TENANT_COMMON', () => {
    it('should have value "common" (lowercase)', () => {
      expect(SettingTypeEnum.TENANT_COMMON).toBe('common')
    })

    it('should not be "COMMON" (uppercase)', () => {
      expect(SettingTypeEnum.TENANT_COMMON).not.toBe('COMMON')
    })

    it('should be usable in partition key generation', () => {
      const pk = `TENANT#${SettingTypeEnum.TENANT_COMMON}`
      expect(pk).toBe('TENANT#common')
    })
  })

  /**
   * Tests for TENANT enum value
   */
  describe('TENANT', () => {
    it('should have value "TENANT"', () => {
      expect(SettingTypeEnum.TENANT).toBe('TENANT')
    })
  })

  /**
   * Tests for TENANT_GROUP enum value
   */
  describe('TENANT_GROUP', () => {
    it('should have value "GROUP"', () => {
      expect(SettingTypeEnum.TENANT_GROUP).toBe('GROUP')
    })
  })

  /**
   * Tests for TENANT_USER enum value
   */
  describe('TENANT_USER', () => {
    it('should have value "USER"', () => {
      expect(SettingTypeEnum.TENANT_USER).toBe('USER')
    })
  })

  /**
   * Tests for enum completeness
   */
  describe('Enum completeness', () => {
    it('should have exactly 4 values', () => {
      const enumValues = Object.values(SettingTypeEnum)
      expect(enumValues).toHaveLength(4)
    })

    it('should contain all expected keys', () => {
      const enumKeys = Object.keys(SettingTypeEnum)
      expect(enumKeys).toContain('TENANT_COMMON')
      expect(enumKeys).toContain('TENANT')
      expect(enumKeys).toContain('TENANT_GROUP')
      expect(enumKeys).toContain('TENANT_USER')
    })
  })
})
