import { registerTools, handleToolCall } from '../tools/index'

describe('MCP Tools', () => {
  describe('registerTools', () => {
    it('should return all available tools', () => {
      const tools = registerTools()

      expect(Array.isArray(tools)).toBe(true)
      expect(tools.length).toBeGreaterThan(0)

      // Check generate tools
      const generateModule = tools.find((t) => t.name === 'mbc_generate_module')
      expect(generateModule).toBeDefined()
      expect(generateModule?.description).toContain('CQRS module')

      // Check validate tools
      const validateCqrs = tools.find((t) => t.name === 'mbc_validate_cqrs')
      expect(validateCqrs).toBeDefined()

      // Check analyze tools
      const analyzeProject = tools.find((t) => t.name === 'mbc_analyze_project')
      expect(analyzeProject).toBeDefined()

      const lookupError = tools.find((t) => t.name === 'mbc_lookup_error')
      expect(lookupError).toBeDefined()
    })

    it('should have valid tool structure with input schema', () => {
      const tools = registerTools()

      tools.forEach((tool) => {
        expect(tool).toHaveProperty('name')
        expect(tool).toHaveProperty('description')
        expect(tool).toHaveProperty('inputSchema')
        expect(tool.inputSchema).toHaveProperty('type', 'object')
        expect(tool.inputSchema).toHaveProperty('properties')
      })
    })
  })

  describe('handleToolCall', () => {
    const projectPath = process.cwd()

    describe('mbc_analyze_project', () => {
      it('should analyze project structure', async () => {
        const result = await handleToolCall(
          'mbc_analyze_project',
          {},
          projectPath
        )

        expect(result).toHaveProperty('content')
        expect(Array.isArray(result.content)).toBe(true)
        expect(result.content[0]).toHaveProperty('type', 'text')
        expect(result.content[0]).toHaveProperty('text')
        expect(result.content[0].text).toContain('Project Analysis')
      })

      it('should include structure summary', async () => {
        const result = await handleToolCall(
          'mbc_analyze_project',
          {},
          projectPath
        )

        const text = result.content[0].text
        expect(text).toContain('Structure Summary')
        expect(text).toContain('Modules')
        expect(text).toContain('Entities')
      })
    })

    describe('mbc_validate_cqrs', () => {
      it('should validate CQRS patterns', async () => {
        const result = await handleToolCall(
          'mbc_validate_cqrs',
          {},
          projectPath
        )

        expect(result).toHaveProperty('content')
        expect(result.content[0]).toHaveProperty('text')
        // Should contain validation result (passed or failed)
        expect(result.content[0].text).toMatch(/Validation (Passed|Failed)/)
      })
    })

    describe('mbc_lookup_error', () => {
      it('should look up error by message', async () => {
        const result = await handleToolCall(
          'mbc_lookup_error',
          { error_message: 'version not match' },
          projectPath
        )

        expect(result).toHaveProperty('content')
        expect(result.content[0]).toHaveProperty('text')
      })

      it('should return helpful message for unknown error', async () => {
        const result = await handleToolCall(
          'mbc_lookup_error',
          { error_message: 'some completely unknown error xyz123' },
          projectPath
        )

        expect(result).toHaveProperty('content')
        // Either "No matching error found" or "Error catalog not found" is valid
        expect(result.content[0].text).toMatch(
          /(No matching error found|Error catalog not found)/
        )
      })
    })

    describe('mbc_generate_module', () => {
      it('should return CLI not installed error when CLI is missing', async () => {
        const result = await handleToolCall(
          'mbc_generate_module',
          { name: 'test' },
          '/tmp/nonexistent-project'
        )

        expect(result).toHaveProperty('content')
        expect(result.content[0].text).toMatch(
          /(CLI|not installed|package.json)/i
        )
        expect(result.isError).toBe(true)
      })
    })

    describe('unknown tool', () => {
      it('should return error for unknown tool', async () => {
        const result = await handleToolCall(
          'unknown_tool',
          {},
          projectPath
        )

        expect(result).toHaveProperty('content')
        expect(result.content[0].text).toContain('Unknown tool')
        expect(result.isError).toBe(true)
      })
    })
  })
})
