import { normalizeToKebabOrSnakeCase } from './formatting'

describe('Formatting Utilities', () => {
  describe('Overview: String normalization functionality', () => {
    describe('Purpose: Test normalizeToKebabOrSnakeCase with various input formats', () => {
      it('should convert camelCase to kebab-case', () => {
        expect(normalizeToKebabOrSnakeCase('camelCaseString')).toBe('camel-case-string')
        expect(normalizeToKebabOrSnakeCase('myTestVariable')).toBe('my-test-variable')
        expect(normalizeToKebabOrSnakeCase('XMLHttpRequest')).toBe('xmlhttp-request')
      })

      it('should convert PascalCase to kebab-case', () => {
        expect(normalizeToKebabOrSnakeCase('PascalCaseString')).toBe('pascal-case-string')
        expect(normalizeToKebabOrSnakeCase('MyTestClass')).toBe('my-test-class')
        expect(normalizeToKebabOrSnakeCase('HTTPSConnection')).toBe('httpsconnection')
      })

      it('should handle strings with spaces', () => {
        expect(normalizeToKebabOrSnakeCase('string with spaces')).toBe('string-with-spaces')
        expect(normalizeToKebabOrSnakeCase('Multiple   spaces   here')).toBe('multiple---spaces---here')
        expect(normalizeToKebabOrSnakeCase(' leading and trailing spaces ')).toBe('-leading-and-trailing-spaces-')
      })

      it('should handle strings with underscores', () => {
        expect(normalizeToKebabOrSnakeCase('snake_case_string')).toBe('snake_case_string')
        expect(normalizeToKebabOrSnakeCase('mixed_snake_camelCase')).toBe('mixed_snake_camel-case')
        expect(normalizeToKebabOrSnakeCase('__double__underscores__')).toBe('__double__underscores__')
      })

      it('should handle already kebab-case strings', () => {
        expect(normalizeToKebabOrSnakeCase('kebab-case-string')).toBe('kebab-case-string')
        expect(normalizeToKebabOrSnakeCase('already-formatted')).toBe('already-formatted')
        expect(normalizeToKebabOrSnakeCase('single')).toBe('single')
      })
    })

    describe('Purpose: Test edge cases and special characters', () => {
      it('should handle empty inputs', () => {
        expect(normalizeToKebabOrSnakeCase('')).toBe('')
      })

      it('should handle null and undefined inputs with error', () => {
        expect(() => normalizeToKebabOrSnakeCase(null as any)).toThrow()
        expect(() => normalizeToKebabOrSnakeCase(undefined as any)).toThrow()
      })

      it('should handle numeric strings', () => {
        expect(normalizeToKebabOrSnakeCase('123')).toBe('123')
        expect(normalizeToKebabOrSnakeCase('version2')).toBe('version2')
        expect(normalizeToKebabOrSnakeCase('test123Variable')).toBe('test123-variable')
      })

      it('should handle special characters', () => {
        expect(normalizeToKebabOrSnakeCase('test@email.com')).toBe('test@email.com')
        expect(normalizeToKebabOrSnakeCase('file.name.extension')).toBe('file.name.extension')
        expect(normalizeToKebabOrSnakeCase('path/to/file')).toBe('path/to/file')
      })

      it('should handle mixed case with numbers', () => {
        expect(normalizeToKebabOrSnakeCase('HTML5Parser')).toBe('html5-parser')
        expect(normalizeToKebabOrSnakeCase('CSS3Styles')).toBe('css3-styles')
        expect(normalizeToKebabOrSnakeCase('API2Client')).toBe('api2-client')
      })

      it('should handle consecutive uppercase letters', () => {
        expect(normalizeToKebabOrSnakeCase('XMLParser')).toBe('xmlparser')
        expect(normalizeToKebabOrSnakeCase('HTTPSRequest')).toBe('httpsrequest')
        expect(normalizeToKebabOrSnakeCase('JSONData')).toBe('jsondata')
      })
    })

    describe('Purpose: Test boundary conditions', () => {
      it('should handle very long strings', () => {
        const longString = 'thisIsAVeryLongCamelCaseStringThatShouldBeConvertedToKebabCase'
        const expected = 'this-is-avery-long-camel-case-string-that-should-be-converted-to-kebab-case'
        expect(normalizeToKebabOrSnakeCase(longString)).toBe(expected)
      })

      it('should handle single character strings', () => {
        expect(normalizeToKebabOrSnakeCase('a')).toBe('a')
        expect(normalizeToKebabOrSnakeCase('A')).toBe('a')
        expect(normalizeToKebabOrSnakeCase('1')).toBe('1')
      })

      it('should handle strings with only special characters', () => {
        expect(normalizeToKebabOrSnakeCase('___')).toBe('___')
        expect(normalizeToKebabOrSnakeCase('---')).toBe('---')
        expect(normalizeToKebabOrSnakeCase('...')).toBe('...')
      })
    })

    describe('Purpose: Test performance with various input sizes', () => {
      it('should handle repeated transformations consistently', () => {
        const input = 'testCamelCaseString'
        const expected = 'test-camel-case-string'
        
        for (let i = 0; i < 100; i++) {
          expect(normalizeToKebabOrSnakeCase(input)).toBe(expected)
        }
      })

      it('should handle array of different string formats', () => {
        const inputs = [
          'camelCase',
          'PascalCase',
          'snake_case',
          'kebab-case',
          'UPPERCASE',
          'lowercase',
          'Mixed_Format-String'
        ]
        
        const results = inputs.map(input => normalizeToKebabOrSnakeCase(input))
        
        expect(results).toEqual([
          'camel-case',
          'pascal-case',
          'snake_case',
          'kebab-case',
          'uppercase',
          'lowercase',
          'mixed_format-string'
        ])
      })
    })
  })
})
