#!/usr/bin/env node

/**
 * MCP Server executable for MBC CQRS Serverless framework.
 *
 * Usage:
 *   npx @mbc-cqrs-serverless/mcp-server
 *
 * Environment Variables:
 *   MBC_PROJECT_PATH - Path to the project directory (defaults to cwd)
 */

require('../dist/index.js')
