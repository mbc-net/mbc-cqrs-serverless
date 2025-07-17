import { SchematicOption } from './schematic.option'

describe('Schematic Option', () => {
  describe('Overview: Command option handling and formatting functionality', () => {
    describe('Purpose: Test basic option creation and formatting', () => {
      it('should create string option and format correctly', () => {
        const option = new SchematicOption('name', 'test-service')
        
        expect(option.toCommandString()).toBe('--name=test-service')
      })

      it('should create boolean option and format correctly', () => {
        const option = new SchematicOption('dry-run', true)
        
        expect(option.toCommandString()).toBe('--dry-run')
      })

      it('should create false boolean option and format correctly', () => {
        const option = new SchematicOption('schema', false)
        
        expect(option.toCommandString()).toBe('--no-schema')
      })
    })

    describe('Purpose: Test name normalization functionality', () => {
      it('should normalize camelCase names to kebab-case', () => {
        const option = new SchematicOption('dryRun', true)
        
        expect(option.normalizedName).toBe('dry-run')
        expect(option.toCommandString()).toBe('--dry-run')
      })

      it('should normalize snake_case names correctly', () => {
        const option = new SchematicOption('spec_file_suffix', 'spec')
        
        expect(option.normalizedName).toBe('spec_file_suffix')
      })

      it('should handle already normalized names', () => {
        const option = new SchematicOption('dry-run', true)
        
        expect(option.normalizedName).toBe('dry-run')
      })
    })

    describe('Purpose: Test special option handling', () => {
      it('should handle name option with special formatting', () => {
        const option = new SchematicOption('name', 'TestService')
        
        expect(option.toCommandString()).toBe('--name=test-service')
      })

      it('should handle version option without quotes', () => {
        const option = new SchematicOption('version', '1.0.0')
        
        expect(option.toCommandString()).toBe('--version=1.0.0')
      })

      it('should handle path option without quotes', () => {
        const option = new SchematicOption('path', './src/services')
        
        expect(option.toCommandString()).toBe('--path=./src/services')
      })

      it('should handle other string options with quotes', () => {
        const option = new SchematicOption('description', 'A test service')
        
        expect(option.toCommandString()).toBe('--description="A test service"')
      })
    })

    describe('Purpose: Test special character escaping', () => {
      it('should escape parentheses in name values', () => {
        const option = new SchematicOption('name', 'test(service)')
        
        expect(option.toCommandString()).toBe('--name=test\\(service\\)')
      })

      it('should escape brackets in name values', () => {
        const option = new SchematicOption('name', 'test[service]')
        
        expect(option.toCommandString()).toBe('--name=test\\[service\\]')
      })

      it('should handle mixed special characters', () => {
        const option = new SchematicOption('name', 'test(service)[v1]')
        
        expect(option.toCommandString()).toBe('--name=test\\(service\\)\\[v1\\]')
      })
    })

    describe('Purpose: Test edge cases and boundary conditions', () => {
      it('should handle empty string values', () => {
        const option = new SchematicOption('name', '')
        
        expect(option.toCommandString()).toBe('--name=')
      })

      it('should handle numeric values', () => {
        const option = new SchematicOption('port', 3000 as any)
        
        expect(option.toCommandString()).toBe('--port=3000')
      })

      it('should handle null values', () => {
        const option = new SchematicOption('test', null as any)
        
        expect(option.toCommandString()).toBe('--test=null')
      })

      it('should handle undefined values', () => {
        const option = new SchematicOption('test', undefined as any)
        
        expect(option.toCommandString()).toBe('--test=undefined')
      })
    })

    describe('Purpose: Test complex option scenarios', () => {
      it('should handle options with spaces in values', () => {
        const option = new SchematicOption('description', 'A complex service description')
        
        expect(option.toCommandString()).toBe('--description="A complex service description"')
      })

      it('should handle options with quotes in values', () => {
        const option = new SchematicOption('description', 'A "quoted" description')
        
        expect(option.toCommandString()).toBe('--description="A "quoted" description"')
      })

      it('should handle very long option names', () => {
        const longName = 'veryLongOptionNameThatExceedsNormalLengthLimits'
        const option = new SchematicOption(longName, 'value')
        
        expect(option.normalizedName).toBe('very-long-option-name-that-exceeds-normal-length-limits')
      })

      it('should handle very long option values', () => {
        const longValue = 'A'.repeat(1000)
        const option = new SchematicOption('description', longValue)
        
        expect(option.toCommandString()).toBe(`--description="${longValue}"`)
      })
    })

    describe('Purpose: Test option type consistency', () => {
      it('should maintain consistent formatting across multiple calls', () => {
        const option = new SchematicOption('dry-run', true)
        
        const result1 = option.toCommandString()
        const result2 = option.toCommandString()
        
        expect(result1).toBe(result2)
        expect(result1).toBe('--dry-run')
      })

      it('should handle boolean toggle scenarios', () => {
        const trueOption = new SchematicOption('feature', true)
        const falseOption = new SchematicOption('feature', false)
        
        expect(trueOption.toCommandString()).toBe('--feature')
        expect(falseOption.toCommandString()).toBe('--no-feature')
      })

      it('should handle string vs boolean distinction', () => {
        const stringOption = new SchematicOption('value', 'true')
        const booleanOption = new SchematicOption('value', true)
        
        expect(stringOption.toCommandString()).toBe('--value="true"')
        expect(booleanOption.toCommandString()).toBe('--value')
      })
    })
  })
})
