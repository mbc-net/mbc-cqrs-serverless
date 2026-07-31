import { Tool } from '@modelcontextprotocol/sdk/types.js'

import { getAnalyzeTools, handleAnalyzeTool } from './analyze.js'
import { getGenerateTools, handleGenerateTool } from './generate.js'
import { getValidateTools, handleValidateTool } from './validate.js'

const GENERATE_TOOLS = getGenerateTools()
const VALIDATE_TOOLS = getValidateTools()
const ANALYZE_TOOLS = getAnalyzeTools()

const ALL_TOOLS: Tool[] = [
  ...GENERATE_TOOLS,
  ...VALIDATE_TOOLS,
  ...ANALYZE_TOOLS,
]
const ANALYZE_TOOL_NAMES = new Set(ANALYZE_TOOLS.map((t) => t.name))

/**
 * Register all available tools.
 */
export function registerTools(): Tool[] {
  return ALL_TOOLS
}

/**
 * Handle tool calls by routing to the appropriate handler.
 */
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  projectPath: string,
): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  if (name.startsWith('mbc_generate_')) {
    return handleGenerateTool(name, args, projectPath)
  }

  if (name.startsWith('mbc_validate_')) {
    return handleValidateTool(name, args, projectPath)
  }

  if (ANALYZE_TOOL_NAMES.has(name)) {
    return handleAnalyzeTool(name, args, projectPath)
  }

  return {
    content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    isError: true,
  }
}
