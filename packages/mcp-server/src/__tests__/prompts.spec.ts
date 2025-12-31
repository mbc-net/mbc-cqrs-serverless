import { registerPrompts, handlePromptGet } from '../prompts/index'

describe('MCP Prompts', () => {
  describe('registerPrompts', () => {
    it('should return all available prompts', () => {
      const prompts = registerPrompts()

      expect(Array.isArray(prompts)).toBe(true)
      expect(prompts.length).toBeGreaterThan(0)

      // Check CQRS guide prompt
      const cqrsGuide = prompts.find(
        (p) => p.name === 'cqrs_implementation_guide'
      )
      expect(cqrsGuide).toBeDefined()
      expect(cqrsGuide?.description).toContain('CQRS')

      // Check debug prompt
      const debugPrompt = prompts.find((p) => p.name === 'debug_command_error')
      expect(debugPrompt).toBeDefined()

      // Check migration prompt
      const migrationPrompt = prompts.find((p) => p.name === 'migration_guide')
      expect(migrationPrompt).toBeDefined()
    })

    it('should have valid prompt structure with arguments', () => {
      const prompts = registerPrompts()

      prompts.forEach((prompt) => {
        expect(prompt).toHaveProperty('name')
        expect(prompt).toHaveProperty('description')
        expect(prompt).toHaveProperty('arguments')
        expect(Array.isArray(prompt.arguments)).toBe(true)
      })
    })
  })

  describe('handlePromptGet', () => {
    describe('cqrs_implementation_guide', () => {
      it('should return implementation guide for module', () => {
        const result = handlePromptGet('cqrs_implementation_guide', {
          feature_type: 'module',
          feature_name: 'Order',
        })

        expect(result).toHaveProperty('messages')
        expect(Array.isArray(result.messages)).toBe(true)
        expect(result.messages.length).toBeGreaterThan(0)

        // Should have user and assistant messages
        const userMessage = result.messages.find((m) => m.role === 'user')
        const assistantMessage = result.messages.find(
          (m) => m.role === 'assistant'
        )

        expect(userMessage).toBeDefined()
        expect(assistantMessage).toBeDefined()
        expect((assistantMessage?.content as any).text).toContain('Order')
      })

      it('should return guide for entity', () => {
        const result = handlePromptGet('cqrs_implementation_guide', {
          feature_type: 'entity',
          feature_name: 'Product',
        })

        expect(result.messages.length).toBeGreaterThan(0)
        const assistantMessage = result.messages.find(
          (m) => m.role === 'assistant'
        )
        expect((assistantMessage?.content as any).text).toContain('Product')
        expect((assistantMessage?.content as any).text).toContain('Entity')
      })

      it('should use default values when arguments missing', () => {
        const result = handlePromptGet('cqrs_implementation_guide', {})

        expect(result).toHaveProperty('messages')
        expect(result.messages.length).toBeGreaterThan(0)
      })
    })

    describe('debug_command_error', () => {
      it('should return debug guidance', () => {
        const result = handlePromptGet('debug_command_error', {
          error_message: 'version mismatch',
          operation: 'update',
        })

        expect(result).toHaveProperty('messages')
        expect(result.messages.length).toBeGreaterThan(0)

        const assistantMessage = result.messages.find(
          (m) => m.role === 'assistant'
        )
        expect((assistantMessage?.content as any).text).toContain('Debugging')
      })

      it('should handle missing operation argument', () => {
        const result = handlePromptGet('debug_command_error', {
          error_message: 'some error',
        })

        expect(result).toHaveProperty('messages')
        expect(result.messages.length).toBeGreaterThan(0)
      })
    })

    describe('migration_guide', () => {
      it('should return migration guidance', () => {
        const result = handlePromptGet('migration_guide', {
          from_version: '0.1.0',
          to_version: '0.2.0',
        })

        expect(result).toHaveProperty('messages')
        expect(result.messages.length).toBeGreaterThan(0)

        const assistantMessage = result.messages.find(
          (m) => m.role === 'assistant'
        )
        expect((assistantMessage?.content as any).text).toContain('Migration')
      })
    })

    describe('unknown prompt', () => {
      it('should return error message for unknown prompt', () => {
        const result = handlePromptGet('unknown_prompt', {})

        expect(result).toHaveProperty('messages')
        expect(result.messages[0].content).toHaveProperty('text')
        expect((result.messages[0].content as any).text).toContain('Unknown prompt')
      })
    })
  })
})
