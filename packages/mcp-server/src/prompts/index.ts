import { Prompt, PromptMessage } from '@modelcontextprotocol/sdk/types.js'
import { getCqrsPrompts, getCqrsPromptMessages } from './cqrs-guide.js'

/**
 * Register all available prompts.
 */
export function registerPrompts(): Prompt[] {
  return [
    ...getCqrsPrompts(),
  ]
}

/**
 * Handle prompt get requests.
 */
export function handlePromptGet(
  name: string,
  args?: Record<string, string>
): { messages: PromptMessage[] } {
  const safeArgs = args || {}

  // CQRS prompts
  const cqrsPromptNames = ['cqrs_implementation_guide', 'debug_command_error', 'migration_guide']
  if (cqrsPromptNames.includes(name)) {
    return getCqrsPromptMessages(name, safeArgs)
  }

  return {
    messages: [
      {
        role: 'user',
        content: { type: 'text', text: `Unknown prompt: ${name}` },
      },
    ],
  }
}
