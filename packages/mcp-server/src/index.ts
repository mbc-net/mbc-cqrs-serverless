#!/usr/bin/env node

import { McpServer } from './server.js'

/**
 * MCP Server for MBC CQRS Serverless framework.
 *
 * This server provides:
 * - Resources: Framework documentation, error catalog, project info
 * - Tools: Code generation, validation, analysis
 * - Prompts: CQRS implementation guides, debugging help
 *
 * @example
 * // Run the server
 * npx @mbc-cqrs-serverless/mcp-server
 *
 * // Configure in Claude Code
 * // Add to ~/.claude/claude_desktop_config.json:
 * {
 *   "mcpServers": {
 *     "mbc-cqrs-serverless": {
 *       "command": "npx",
 *       "args": ["@mbc-cqrs-serverless/mcp-server"],
 *       "env": {
 *         "MBC_PROJECT_PATH": "/path/to/your/project"
 *       }
 *     }
 *   }
 * }
 */

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('[Uncaught Exception]', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection]', reason)
})

async function main() {
  try {
    const server = new McpServer()
    await server.run()
  } catch (error) {
    console.error('[Fatal Error]', error)
    process.exit(1)
  }
}

main()
