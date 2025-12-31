import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js'

import { registerResources, handleResourceRead } from './resources/index.js'
import { registerTools, handleToolCall } from './tools/index.js'
import { registerPrompts, handlePromptGet } from './prompts/index.js'

/**
 * MCP Server for MBC CQRS Serverless framework.
 * Provides resources, tools, and prompts for AI-powered development.
 */
export class McpServer {
  private server: Server
  private projectPath: string

  constructor() {
    this.projectPath = process.env.MBC_PROJECT_PATH || process.cwd()

    this.server = new Server(
      {
        name: 'mbc-cqrs-serverless',
        version: '0.1.74-beta.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
          prompts: {},
        },
      }
    )

    this.setupHandlers()
    this.setupErrorHandling()
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Server Error]', error)
    }

    process.on('unhandledRejection', (reason, promise) => {
      console.error('[Unhandled Rejection]', reason)
    })
  }

  private setupHandlers(): void {
    // Resource handlers
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      try {
        return {
          resources: registerResources(),
        }
      } catch (error) {
        console.error('[ListResources Error]', error)
        throw new McpError(ErrorCode.InternalError, `Failed to list resources: ${error}`)
      }
    })

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        return await handleResourceRead(request.params.uri, this.projectPath)
      } catch (error) {
        console.error('[ReadResource Error]', error)
        throw new McpError(ErrorCode.InternalError, `Failed to read resource: ${error}`)
      }
    })

    // Tool handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        return {
          tools: registerTools(),
        }
      } catch (error) {
        console.error('[ListTools Error]', error)
        throw new McpError(ErrorCode.InternalError, `Failed to list tools: ${error}`)
      }
    })

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        return await handleToolCall(
          request.params.name,
          request.params.arguments || {},
          this.projectPath
        )
      } catch (error) {
        console.error('[CallTool Error]', error)
        return {
          content: [{ type: 'text', text: `Error: ${error}` }],
          isError: true,
        }
      }
    })

    // Prompt handlers
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      try {
        return {
          prompts: registerPrompts(),
        }
      } catch (error) {
        console.error('[ListPrompts Error]', error)
        throw new McpError(ErrorCode.InternalError, `Failed to list prompts: ${error}`)
      }
    })

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      try {
        return handlePromptGet(request.params.name, request.params.arguments || {})
      } catch (error) {
        console.error('[GetPrompt Error]', error)
        throw new McpError(ErrorCode.InternalError, `Failed to get prompt: ${error}`)
      }
    })
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport()
    await this.server.connect(transport)
    console.error('MBC CQRS Serverless MCP server running on stdio')
  }
}
