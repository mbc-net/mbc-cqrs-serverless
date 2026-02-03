import { Tool } from '@modelcontextprotocol/sdk/types.js'

import { getAnalyzeTools, handleAnalyzeTool } from './analyze.js'
import { getGenerateTools, handleGenerateTool } from './generate.js'
import { getValidateTools, handleValidateTool } from './validate.js'

/**
 * Register all available tools.
 */
export function registerTools(): Tool[] {
  return [...getGenerateTools(), ...getValidateTools(), ...getAnalyzeTools()]
}

/**
 * Handle tool calls.
 */
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  projectPath: string,
): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  // Generate tools
  if (name.startsWith('mbc_generate_')) {
    return handleGenerateTool(name, args, projectPath)
  }

  // Validate tools
  if (name.startsWith('mbc_validate_')) {
    return handleValidateTool(name, args, projectPath)
  }

  // Analyze tools
  if (name.startsWith('mbc_analyze_') || name === 'mbc_lookup_error') {
    return handleAnalyzeTool(name, args, projectPath)
  }

  return {
    content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    isError: true,
  }
}
