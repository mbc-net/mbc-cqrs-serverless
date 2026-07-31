import { Prompt, PromptMessage } from '@modelcontextprotocol/sdk/types.js'

import { getCqrsPromptMessages, getCqrsPrompts } from './cqrs-guide.js'

const ALL_PROMPTS: Prompt[] = [...getCqrsPrompts()]
const PROMPT_NAMES = new Set(ALL_PROMPTS.map((p) => p.name))

/**
 * Register all available prompts.
 */
export function registerPrompts(): Prompt[] {
  return ALL_PROMPTS
}

/**
 * Handle prompt get requests.
 */
export function handlePromptGet(
  name: string,
  args?: Record<string, string>,
): { messages: PromptMessage[] } {
  const safeArgs = args || {}

  if (PROMPT_NAMES.has(name)) {
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
