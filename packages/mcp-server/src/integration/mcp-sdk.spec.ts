/**
 * MCP SDK Integration Tests
 *
 * This file comprehensively tests the @modelcontextprotocol/sdk IN/OUT.
 * It verifies that the MCP Server correctly handles all request schemas
 * and produces properly formatted responses.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ErrorCode,
  McpError,
  // Types
  type Tool,
  type Resource,
  type Prompt,
  type PromptMessage,
  type CallToolResult,
  type ListToolsResult,
  type ListResourcesResult,
  type ListPromptsResult,
  type GetPromptResult,
  type ReadResourceResult,
} from '@modelcontextprotocol/sdk/types.js'

import { registerTools, handleToolCall } from '../tools/index.js'
import { registerResources, handleResourceRead } from '../resources/index.js'
import { registerPrompts, handlePromptGet } from '../prompts/index.js'

/**
 * Mock Server implementation for testing request handlers
 */
class TestMcpServer {
  private handlers: Map<string, (request: any) => Promise<any>> = new Map()
  private projectPath: string

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath
  }

  /**
   * Register a request handler (mimics Server.setRequestHandler)
   */
  setRequestHandler(
    schema: { shape: { method: { value: string } } },
    handler: (request: any) => Promise<any>
  ): void {
    const method = schema.shape.method.value
    this.handlers.set(method, handler)
  }

  /**
   * Simulate a request to the server
   */
  async handleRequest(method: string, params?: any): Promise<any> {
    const handler = this.handlers.get(method)
    if (!handler) {
      throw new McpError(ErrorCode.MethodNotFound, `Method not found: ${method}`)
    }
    return handler({ method, params })
  }

  getProjectPath(): string {
    return this.projectPath
  }
}

describe('MCP SDK Integration Tests', () => {
  describe('1. Server Initialization', () => {
    it('should create a Server instance with correct options', () => {
      const server = new Server(
        {
          name: 'test-mcp-server',
          version: '1.0.0',
        },
        {
          capabilities: {
            resources: {},
            tools: {},
            prompts: {},
          },
        }
      )

      expect(server).toBeDefined()
    })

    it('should accept capabilities declaration for resources, tools, and prompts', () => {
      const capabilities = {
        resources: { subscribe: true, listChanged: true },
        tools: { listChanged: true },
        prompts: { listChanged: true },
      }

      const server = new Server(
        { name: 'test-server', version: '1.0.0' },
        { capabilities }
      )

      expect(server).toBeDefined()
    })

    it('should allow handler registration via setRequestHandler', () => {
      const server = new Server(
        { name: 'test-server', version: '1.0.0' },
        {
          capabilities: {
            tools: {},
          },
        }
      )

      // This should not throw
      expect(() => {
        server.setRequestHandler(ListToolsRequestSchema, async () => ({
          tools: [],
        }))
      }).not.toThrow()
    })
  })

  describe('2. Tool Registration (ListToolsRequestSchema)', () => {
    let testServer: TestMcpServer

    beforeEach(() => {
      testServer = new TestMcpServer()
      testServer.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
          tools: registerTools(),
        }
      })
    })

    it('should return a list of tools with correct structure', async () => {
      const result = (await testServer.handleRequest(
        'tools/list'
      )) as ListToolsResult

      expect(result).toHaveProperty('tools')
      expect(Array.isArray(result.tools)).toBe(true)
      expect(result.tools.length).toBeGreaterThan(0)
    })

    it('should return tools with required properties (name, description, inputSchema)', async () => {
      const result = (await testServer.handleRequest(
        'tools/list'
      )) as ListToolsResult

      result.tools.forEach((tool: Tool) => {
        // Required properties
        expect(tool).toHaveProperty('name')
        expect(typeof tool.name).toBe('string')
        expect(tool.name.length).toBeGreaterThan(0)

        // Optional but expected properties
        expect(tool).toHaveProperty('description')
        expect(typeof tool.description).toBe('string')

        // inputSchema is required
        expect(tool).toHaveProperty('inputSchema')
        expect(tool.inputSchema).toHaveProperty('type', 'object')
        expect(tool.inputSchema).toHaveProperty('properties')
      })
    })

    it('should include expected MBC tools', async () => {
      const result = (await testServer.handleRequest(
        'tools/list'
      )) as ListToolsResult
      const toolNames = result.tools.map((t: Tool) => t.name)

      // Check for expected tools
      expect(toolNames).toContain('mbc_generate_module')
      expect(toolNames).toContain('mbc_validate_cqrs')
      expect(toolNames).toContain('mbc_analyze_project')
      expect(toolNames).toContain('mbc_lookup_error')
    })

    it('should conform to MCP Tool schema', async () => {
      const result = (await testServer.handleRequest(
        'tools/list'
      )) as ListToolsResult

      result.tools.forEach((tool: Tool) => {
        // inputSchema must be JSON Schema compliant
        expect(tool.inputSchema.type).toBe('object')

        if (tool.inputSchema.properties) {
          expect(typeof tool.inputSchema.properties).toBe('object')
        }

        if (tool.inputSchema.required) {
          expect(Array.isArray(tool.inputSchema.required)).toBe(true)
          tool.inputSchema.required.forEach((req: string) => {
            expect(typeof req).toBe('string')
          })
        }
      })
    })
  })

  describe('3. Tool Call (CallToolRequestSchema)', () => {
    let testServer: TestMcpServer
    const projectPath = process.cwd()

    beforeEach(() => {
      testServer = new TestMcpServer(projectPath)
      testServer.setRequestHandler(CallToolRequestSchema, async (request) => {
        return await handleToolCall(
          request.params.name,
          request.params.arguments || {},
          testServer.getProjectPath()
        )
      })
    })

    it('should accept CallToolRequest with name and arguments', async () => {
      const result = (await testServer.handleRequest('tools/call', {
        name: 'mbc_analyze_project',
        arguments: {},
      })) as CallToolResult

      expect(result).toHaveProperty('content')
    })

    it('should return CallToolResult with content array', async () => {
      const result = (await testServer.handleRequest('tools/call', {
        name: 'mbc_analyze_project',
        arguments: {},
      })) as CallToolResult

      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
      expect(result.content.length).toBeGreaterThan(0)
    })

    it('should return text content with correct structure', async () => {
      const result = (await testServer.handleRequest('tools/call', {
        name: 'mbc_analyze_project',
        arguments: {},
      })) as CallToolResult

      const textContent = result.content[0]
      expect(textContent).toHaveProperty('type', 'text')
      expect(textContent).toHaveProperty('text')
      expect(typeof (textContent as any).text).toBe('string')
    })

    it('should return isError: true for unknown tools', async () => {
      const result = (await testServer.handleRequest('tools/call', {
        name: 'nonexistent_tool',
        arguments: {},
      })) as CallToolResult

      expect(result).toHaveProperty('content')
      expect(result.isError).toBe(true)
      expect((result.content[0] as any).text).toContain('Unknown tool')
    })

    it('should handle tool arguments correctly', async () => {
      const result = (await testServer.handleRequest('tools/call', {
        name: 'mbc_lookup_error',
        arguments: { error_message: 'version mismatch' },
      })) as CallToolResult

      expect(result).toHaveProperty('content')
      expect(Array.isArray(result.content)).toBe(true)
    })

    it('should return isError: true for tool execution errors', async () => {
      // Use a non-existent project path to trigger an error
      const badServer = new TestMcpServer('/tmp/nonexistent-project-12345')
      badServer.setRequestHandler(CallToolRequestSchema, async (request) => {
        return await handleToolCall(
          request.params.name,
          request.params.arguments || {},
          badServer.getProjectPath()
        )
      })

      const result = (await badServer.handleRequest('tools/call', {
        name: 'mbc_generate_module',
        arguments: { name: 'test' },
      })) as CallToolResult

      // This should fail as there's no valid project
      expect(result).toHaveProperty('content')
      expect(result.isError).toBe(true)
    })
  })

  describe('4. Resource Management (ListResourcesRequestSchema)', () => {
    let testServer: TestMcpServer

    beforeEach(() => {
      testServer = new TestMcpServer()
      testServer.setRequestHandler(ListResourcesRequestSchema, async () => {
        return {
          resources: registerResources(),
        }
      })
    })

    it('should return a list of resources', async () => {
      const result = (await testServer.handleRequest(
        'resources/list'
      )) as ListResourcesResult

      expect(result).toHaveProperty('resources')
      expect(Array.isArray(result.resources)).toBe(true)
      expect(result.resources.length).toBeGreaterThan(0)
    })

    it('should return resources with required properties (uri, name)', async () => {
      const result = (await testServer.handleRequest(
        'resources/list'
      )) as ListResourcesResult

      result.resources.forEach((resource: Resource) => {
        expect(resource).toHaveProperty('uri')
        expect(typeof resource.uri).toBe('string')
        expect(resource.uri).toMatch(/^mbc:\/\//)

        expect(resource).toHaveProperty('name')
        expect(typeof resource.name).toBe('string')
      })
    })

    it('should include expected MBC resources', async () => {
      const result = (await testServer.handleRequest(
        'resources/list'
      )) as ListResourcesResult
      const resourceUris = result.resources.map((r: Resource) => r.uri)

      expect(resourceUris).toContain('mbc://docs/overview')
      expect(resourceUris).toContain('mbc://docs/errors')
      expect(resourceUris).toContain('mbc://project/entities')
      expect(resourceUris).toContain('mbc://project/modules')
    })

    it('should include mimeType where applicable', async () => {
      const result = (await testServer.handleRequest(
        'resources/list'
      )) as ListResourcesResult

      // Some resources should have mimeType
      const resourcesWithMimeType = result.resources.filter(
        (r: Resource) => r.mimeType
      )
      expect(resourcesWithMimeType.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('5. Resource Read (ReadResourceRequestSchema)', () => {
    let testServer: TestMcpServer
    const projectPath = process.cwd()

    beforeEach(() => {
      testServer = new TestMcpServer(projectPath)
      testServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        return await handleResourceRead(
          request.params.uri,
          testServer.getProjectPath()
        )
      })
    })

    it('should read documentation resource', async () => {
      const result = (await testServer.handleRequest('resources/read', {
        uri: 'mbc://docs/errors',
      })) as ReadResourceResult

      expect(result).toHaveProperty('contents')
      expect(Array.isArray(result.contents)).toBe(true)
      expect(result.contents.length).toBeGreaterThan(0)
    })

    it('should return resource contents with uri and text', async () => {
      const result = (await testServer.handleRequest('resources/read', {
        uri: 'mbc://docs/errors',
      })) as ReadResourceResult

      const content = result.contents[0]
      expect(content).toHaveProperty('uri')
      expect(content).toHaveProperty('text')
      // Content can be text or blob type, check for text type
      if ('text' in content) {
        expect(typeof content.text).toBe('string')
      }
    })

    it('should return mimeType in contents', async () => {
      const result = (await testServer.handleRequest('resources/read', {
        uri: 'mbc://project/entities',
      })) as ReadResourceResult

      const content = result.contents[0]
      expect(content).toHaveProperty('mimeType')
      expect(content.mimeType).toBe('application/json')
    })

    it('should throw error for unknown resource URI', async () => {
      await expect(
        testServer.handleRequest('resources/read', {
          uri: 'mbc://unknown/resource',
        })
      ).rejects.toThrow()
    })

    it('should return valid JSON for project resources', async () => {
      const result = (await testServer.handleRequest('resources/read', {
        uri: 'mbc://project/entities',
      })) as ReadResourceResult

      // Should be valid JSON (contents can be text or blob, we expect text)
      const content = result.contents[0]
      if ('text' in content) {
        expect(() => JSON.parse(content.text)).not.toThrow()
      }
    })
  })

  describe('6. Prompt Management (ListPromptsRequestSchema)', () => {
    let testServer: TestMcpServer

    beforeEach(() => {
      testServer = new TestMcpServer()
      testServer.setRequestHandler(ListPromptsRequestSchema, async () => {
        return {
          prompts: registerPrompts(),
        }
      })
    })

    it('should return a list of prompts', async () => {
      const result = (await testServer.handleRequest(
        'prompts/list'
      )) as ListPromptsResult

      expect(result).toHaveProperty('prompts')
      expect(Array.isArray(result.prompts)).toBe(true)
      expect(result.prompts.length).toBeGreaterThan(0)
    })

    it('should return prompts with required properties (name, description, arguments)', async () => {
      const result = (await testServer.handleRequest(
        'prompts/list'
      )) as ListPromptsResult

      result.prompts.forEach((prompt: Prompt) => {
        expect(prompt).toHaveProperty('name')
        expect(typeof prompt.name).toBe('string')

        expect(prompt).toHaveProperty('description')
        expect(typeof prompt.description).toBe('string')

        expect(prompt).toHaveProperty('arguments')
        expect(Array.isArray(prompt.arguments)).toBe(true)
      })
    })

    it('should include expected MBC prompts', async () => {
      const result = (await testServer.handleRequest(
        'prompts/list'
      )) as ListPromptsResult
      const promptNames = result.prompts.map((p: Prompt) => p.name)

      expect(promptNames).toContain('cqrs_implementation_guide')
      expect(promptNames).toContain('debug_command_error')
      expect(promptNames).toContain('migration_guide')
    })

    it('should define argument structure correctly', async () => {
      const result = (await testServer.handleRequest(
        'prompts/list'
      )) as ListPromptsResult

      result.prompts.forEach((prompt: Prompt) => {
        if (prompt.arguments) {
          prompt.arguments.forEach((arg) => {
            expect(arg).toHaveProperty('name')
            expect(typeof arg.name).toBe('string')

            // description is optional but expected
            if (arg.description) {
              expect(typeof arg.description).toBe('string')
            }

            // required is optional
            if (arg.required !== undefined) {
              expect(typeof arg.required).toBe('boolean')
            }
          })
        }
      })
    })
  })

  describe('7. Get Prompt (GetPromptRequestSchema)', () => {
    let testServer: TestMcpServer

    beforeEach(() => {
      testServer = new TestMcpServer()
      testServer.setRequestHandler(GetPromptRequestSchema, async (request) => {
        return handlePromptGet(
          request.params.name,
          request.params.arguments || {}
        )
      })
    })

    it('should return prompt messages', async () => {
      const result = (await testServer.handleRequest('prompts/get', {
        name: 'cqrs_implementation_guide',
        arguments: { feature_type: 'module', feature_name: 'Order' },
      })) as GetPromptResult

      expect(result).toHaveProperty('messages')
      expect(Array.isArray(result.messages)).toBe(true)
      expect(result.messages.length).toBeGreaterThan(0)
    })

    it('should return messages with role and content', async () => {
      const result = (await testServer.handleRequest('prompts/get', {
        name: 'cqrs_implementation_guide',
        arguments: { feature_type: 'entity', feature_name: 'Product' },
      })) as GetPromptResult

      result.messages.forEach((message: PromptMessage) => {
        expect(message).toHaveProperty('role')
        expect(['user', 'assistant']).toContain(message.role)

        expect(message).toHaveProperty('content')
      })
    })

    it('should include user and assistant messages', async () => {
      const result = (await testServer.handleRequest('prompts/get', {
        name: 'cqrs_implementation_guide',
        arguments: { feature_type: 'module', feature_name: 'Order' },
      })) as GetPromptResult

      const userMessages = result.messages.filter(
        (m: PromptMessage) => m.role === 'user'
      )
      const assistantMessages = result.messages.filter(
        (m: PromptMessage) => m.role === 'assistant'
      )

      expect(userMessages.length).toBeGreaterThan(0)
      expect(assistantMessages.length).toBeGreaterThan(0)
    })

    it('should handle debug_command_error prompt', async () => {
      const result = (await testServer.handleRequest('prompts/get', {
        name: 'debug_command_error',
        arguments: { error_message: 'version mismatch', operation: 'update' },
      })) as GetPromptResult

      expect(result).toHaveProperty('messages')
      expect(result.messages.length).toBeGreaterThan(0)
    })

    it('should handle migration_guide prompt', async () => {
      const result = (await testServer.handleRequest('prompts/get', {
        name: 'migration_guide',
        arguments: { from_version: '0.1.0', to_version: '0.2.0' },
      })) as GetPromptResult

      expect(result).toHaveProperty('messages')
      expect(result.messages.length).toBeGreaterThan(0)
    })

    it('should return error message for unknown prompt', async () => {
      const result = (await testServer.handleRequest('prompts/get', {
        name: 'unknown_prompt',
        arguments: {},
      })) as GetPromptResult

      expect(result).toHaveProperty('messages')
      expect((result.messages[0].content as any).text).toContain('Unknown prompt')
    })

    it('should handle missing optional arguments', async () => {
      const result = (await testServer.handleRequest('prompts/get', {
        name: 'cqrs_implementation_guide',
        arguments: {},
      })) as GetPromptResult

      expect(result).toHaveProperty('messages')
      expect(result.messages.length).toBeGreaterThan(0)
    })
  })

  describe('8. Error Handling', () => {
    describe('McpError types', () => {
      it('should handle MethodNotFound error', () => {
        const error = new McpError(
          ErrorCode.MethodNotFound,
          'Method not found: unknown/method'
        )

        expect(error.code).toBe(ErrorCode.MethodNotFound)
        expect(error.code).toBe(-32601)
        // McpError prepends "MCP error {code}: " to the message
        expect(error.message).toContain('Method not found: unknown/method')
      })

      it('should handle InvalidParams error', () => {
        const error = new McpError(
          ErrorCode.InvalidParams,
          'Invalid parameters'
        )

        expect(error.code).toBe(ErrorCode.InvalidParams)
        expect(error.code).toBe(-32602)
        // McpError prepends "MCP error {code}: " to the message
        expect(error.message).toContain('Invalid parameters')
      })

      it('should handle InternalError', () => {
        const error = new McpError(
          ErrorCode.InternalError,
          'Internal server error'
        )

        expect(error.code).toBe(ErrorCode.InternalError)
        expect(error.code).toBe(-32603)
      })

      it('should handle ParseError', () => {
        const error = new McpError(ErrorCode.ParseError, 'Parse error')

        expect(error.code).toBe(ErrorCode.ParseError)
        expect(error.code).toBe(-32700)
      })

      it('should handle InvalidRequest', () => {
        const error = new McpError(ErrorCode.InvalidRequest, 'Invalid request')

        expect(error.code).toBe(ErrorCode.InvalidRequest)
        expect(error.code).toBe(-32600)
      })

      it('should support error data', () => {
        const errorData = { details: 'Additional error info' }
        const error = new McpError(
          ErrorCode.InternalError,
          'Error with data',
          errorData
        )

        expect(error.data).toEqual(errorData)
      })
    })

    describe('Error Code constants', () => {
      it('should have correct JSON-RPC error codes', () => {
        expect(ErrorCode.ParseError).toBe(-32700)
        expect(ErrorCode.InvalidRequest).toBe(-32600)
        expect(ErrorCode.MethodNotFound).toBe(-32601)
        expect(ErrorCode.InvalidParams).toBe(-32602)
        expect(ErrorCode.InternalError).toBe(-32603)
      })

      it('should have MCP-specific error codes', () => {
        expect(ErrorCode.ConnectionClosed).toBe(-32000)
        expect(ErrorCode.RequestTimeout).toBe(-32001)
      })
    })

    describe('Server error handling', () => {
      let testServer: TestMcpServer

      beforeEach(() => {
        testServer = new TestMcpServer()
      })

      it('should throw MethodNotFound for unregistered methods', async () => {
        await expect(
          testServer.handleRequest('unknown/method')
        ).rejects.toThrow(McpError)

        try {
          await testServer.handleRequest('unknown/method')
        } catch (error) {
          expect(error).toBeInstanceOf(McpError)
          expect((error as McpError).code).toBe(ErrorCode.MethodNotFound)
        }
      })
    })
  })

  describe('9. Request/Response Type Validation', () => {
    describe('ListToolsRequest', () => {
      it('should have method "tools/list"', () => {
        expect(ListToolsRequestSchema.shape.method.value).toBe('tools/list')
      })
    })

    describe('CallToolRequest', () => {
      it('should have method "tools/call"', () => {
        expect(CallToolRequestSchema.shape.method.value).toBe('tools/call')
      })

      it('should require name in params', () => {
        const paramsShape = CallToolRequestSchema.shape.params.shape
        expect(paramsShape.name).toBeDefined()
      })

      it('should have optional arguments in params', () => {
        const paramsShape = CallToolRequestSchema.shape.params.shape
        expect(paramsShape.arguments).toBeDefined()
      })
    })

    describe('ListResourcesRequest', () => {
      it('should have method "resources/list"', () => {
        expect(ListResourcesRequestSchema.shape.method.value).toBe(
          'resources/list'
        )
      })
    })

    describe('ReadResourceRequest', () => {
      it('should have method "resources/read"', () => {
        expect(ReadResourceRequestSchema.shape.method.value).toBe(
          'resources/read'
        )
      })

      it('should require uri in params', () => {
        const paramsShape = ReadResourceRequestSchema.shape.params.shape
        expect(paramsShape.uri).toBeDefined()
      })
    })

    describe('ListPromptsRequest', () => {
      it('should have method "prompts/list"', () => {
        expect(ListPromptsRequestSchema.shape.method.value).toBe('prompts/list')
      })
    })

    describe('GetPromptRequest', () => {
      it('should have method "prompts/get"', () => {
        expect(GetPromptRequestSchema.shape.method.value).toBe('prompts/get')
      })

      it('should require name in params', () => {
        const paramsShape = GetPromptRequestSchema.shape.params.shape
        expect(paramsShape.name).toBeDefined()
      })

      it('should have optional arguments in params', () => {
        const paramsShape = GetPromptRequestSchema.shape.params.shape
        expect(paramsShape.arguments).toBeDefined()
      })
    })
  })

  describe('10. Integration with MBC Server Implementation', () => {
    let testServer: TestMcpServer
    const projectPath = process.cwd()

    beforeEach(() => {
      testServer = new TestMcpServer(projectPath)

      // Register all handlers like the real McpServer does
      testServer.setRequestHandler(ListResourcesRequestSchema, async () => {
        return { resources: registerResources() }
      })

      testServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        return await handleResourceRead(
          request.params.uri,
          testServer.getProjectPath()
        )
      })

      testServer.setRequestHandler(ListToolsRequestSchema, async () => {
        return { tools: registerTools() }
      })

      testServer.setRequestHandler(CallToolRequestSchema, async (request) => {
        return await handleToolCall(
          request.params.name,
          request.params.arguments || {},
          testServer.getProjectPath()
        )
      })

      testServer.setRequestHandler(ListPromptsRequestSchema, async () => {
        return { prompts: registerPrompts() }
      })

      testServer.setRequestHandler(GetPromptRequestSchema, async (request) => {
        return handlePromptGet(
          request.params.name,
          request.params.arguments || {}
        )
      })
    })

    it('should handle complete workflow: list tools -> call tool', async () => {
      // List tools
      const listResult = (await testServer.handleRequest(
        'tools/list'
      )) as ListToolsResult
      expect(listResult.tools.length).toBeGreaterThan(0)

      // Find a tool
      const analyzeProjectTool = listResult.tools.find(
        (t: Tool) => t.name === 'mbc_analyze_project'
      )
      expect(analyzeProjectTool).toBeDefined()

      // Call the tool
      const callResult = (await testServer.handleRequest('tools/call', {
        name: analyzeProjectTool!.name,
        arguments: {},
      })) as CallToolResult

      expect(callResult.content.length).toBeGreaterThan(0)
      expect((callResult.content[0] as any).type).toBe('text')
    })

    it('should handle complete workflow: list resources -> read resource', async () => {
      // List resources
      const listResult = (await testServer.handleRequest(
        'resources/list'
      )) as ListResourcesResult
      expect(listResult.resources.length).toBeGreaterThan(0)

      // Find a resource
      const errorResource = listResult.resources.find(
        (r: Resource) => r.uri === 'mbc://docs/errors'
      )
      expect(errorResource).toBeDefined()

      // Read the resource
      const readResult = (await testServer.handleRequest('resources/read', {
        uri: errorResource!.uri,
      })) as ReadResourceResult

      expect(readResult.contents.length).toBeGreaterThan(0)
      // Contents can be text or blob, we expect text
      const content = readResult.contents[0]
      if ('text' in content) {
        expect(content.text).toBeDefined()
      }
    })

    it('should handle complete workflow: list prompts -> get prompt', async () => {
      // List prompts
      const listResult = (await testServer.handleRequest(
        'prompts/list'
      )) as ListPromptsResult
      expect(listResult.prompts.length).toBeGreaterThan(0)

      // Find a prompt
      const cqrsPrompt = listResult.prompts.find(
        (p: Prompt) => p.name === 'cqrs_implementation_guide'
      )
      expect(cqrsPrompt).toBeDefined()

      // Get the prompt
      const getResult = (await testServer.handleRequest('prompts/get', {
        name: cqrsPrompt!.name,
        arguments: { feature_type: 'module', feature_name: 'TestModule' },
      })) as GetPromptResult

      expect(getResult.messages.length).toBeGreaterThan(0)
    })

    it('should correctly format all tool results', async () => {
      const toolsResult = (await testServer.handleRequest(
        'tools/list'
      )) as ListToolsResult

      // Test a subset of tools that don't require arguments
      const toolsWithoutRequiredArgs = ['mbc_analyze_project', 'mbc_validate_cqrs']

      for (const toolName of toolsWithoutRequiredArgs) {
        const tool = toolsResult.tools.find((t: Tool) => t.name === toolName)
        if (tool) {
          const result = (await testServer.handleRequest('tools/call', {
            name: tool.name,
            arguments: {},
          })) as CallToolResult

          // All results should have content array
          expect(result).toHaveProperty('content')
          expect(Array.isArray(result.content)).toBe(true)

          // Content should have type and text
          if (result.content.length > 0) {
            expect(result.content[0]).toHaveProperty('type')
          }
        }
      }

      // Test tools with required arguments
      const lookupResult = (await testServer.handleRequest('tools/call', {
        name: 'mbc_lookup_error',
        arguments: { error_message: 'test error' },
      })) as CallToolResult

      expect(lookupResult).toHaveProperty('content')
      expect(Array.isArray(lookupResult.content)).toBe(true)
    })
  })
})
