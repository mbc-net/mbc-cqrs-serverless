import { Tool } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

import { CliGenerator, GeneratorResult } from './generator.js'

/**
 * Schema definitions for generate tools.
 */
const GenerateModuleSchema = z.object({
  name: z
    .string()
    .describe('Name of the module to generate (e.g., "order", "product")'),
  mode: z
    .enum(['async', 'sync'])
    .optional()
    .describe('Command processing mode: async (default) or sync'),
})

const GenerateComponentSchema = z.object({
  name: z.string().describe('Name of the component to generate'),
})

/**
 * Get all generate tools.
 */
export function getGenerateTools(): Tool[] {
  return [
    {
      name: 'mbc_generate_module',
      description:
        'Generate a new CQRS module with controller, service, entity, and DTOs. This creates a complete module structure following MBC CQRS patterns.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description:
              'Name of the module to generate (e.g., "order", "product")',
          },
          mode: {
            type: 'string',
            enum: ['async', 'sync'],
            description: 'Command processing mode: async (default) or sync',
          },
        },
        required: ['name'],
      },
    },
    {
      name: 'mbc_generate_controller',
      description: 'Generate a new controller for handling HTTP requests.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the controller to generate',
          },
        },
        required: ['name'],
      },
    },
    {
      name: 'mbc_generate_service',
      description: 'Generate a new service for business logic.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the service to generate',
          },
        },
        required: ['name'],
      },
    },
    {
      name: 'mbc_generate_entity',
      description: 'Generate a new entity for data modeling.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the entity to generate',
          },
        },
        required: ['name'],
      },
    },
    {
      name: 'mbc_generate_dto',
      description:
        'Generate a new DTO (Data Transfer Object) for request/response handling.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the DTO to generate',
          },
        },
        required: ['name'],
      },
    },
  ]
}

/**
 * Handle generate tool calls.
 */
export async function handleGenerateTool(
  name: string,
  args: Record<string, unknown>,
  projectPath: string,
): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  const generator = new CliGenerator(projectPath)
  let result: GeneratorResult

  switch (name) {
    case 'mbc_generate_module': {
      const parsed = GenerateModuleSchema.parse(args)
      result = await generator.generateModule(parsed.name, {
        mode: parsed.mode,
      })
      break
    }
    case 'mbc_generate_controller': {
      const parsed = GenerateComponentSchema.parse(args)
      result = await generator.generateController(parsed.name)
      break
    }
    case 'mbc_generate_service': {
      const parsed = GenerateComponentSchema.parse(args)
      result = await generator.generateService(parsed.name)
      break
    }
    case 'mbc_generate_entity': {
      const parsed = GenerateComponentSchema.parse(args)
      result = await generator.generateEntity(parsed.name)
      break
    }
    case 'mbc_generate_dto': {
      const parsed = GenerateComponentSchema.parse(args)
      result = await generator.generateDto(parsed.name)
      break
    }
    default:
      return {
        content: [{ type: 'text', text: `Unknown generate tool: ${name}` }],
        isError: true,
      }
  }

  if (result.success) {
    let message = result.message
    if (result.files && result.files.length > 0) {
      message +=
        '\n\nCreated files:\n' + result.files.map((f) => `- ${f}`).join('\n')
    }
    return {
      content: [{ type: 'text', text: message }],
    }
  } else {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${result.message}\n${result.error || ''}`,
        },
      ],
      isError: true,
    }
  }
}
