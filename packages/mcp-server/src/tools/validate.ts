import { Tool } from '@modelcontextprotocol/sdk/types.js'
import * as fs from 'fs'
import * as path from 'path'
import { z } from 'zod'

/**
 * Validation result interface.
 */
interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
  suggestions: string[]
}

interface ValidationIssue {
  severity: 'error' | 'warning' | 'info'
  message: string
  file?: string
  line?: number
}

const ValidateCqrsSchema = z.object({
  path: z
    .string()
    .optional()
    .describe('Path to validate (defaults to project root)'),
})

/**
 * Get all validate tools.
 */
export function getValidateTools(): Tool[] {
  return [
    {
      name: 'mbc_validate_cqrs',
      description:
        'Validate CQRS pattern implementation in the project. Checks for proper command/query separation, event handling, and entity structure.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to validate (defaults to project root)',
          },
        },
      },
    },
  ]
}

/**
 * Handle validate tool calls.
 */
export async function handleValidateTool(
  name: string,
  args: Record<string, unknown>,
  projectPath: string,
): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  switch (name) {
    case 'mbc_validate_cqrs': {
      const parsed = ValidateCqrsSchema.parse(args)
      const targetPath = parsed.path
        ? path.resolve(projectPath, parsed.path)
        : projectPath
      const result = await validateCqrsPatterns(targetPath)
      return formatValidationResult(result)
    }
    default:
      return {
        content: [{ type: 'text', text: `Unknown validate tool: ${name}` }],
        isError: true,
      }
  }
}

async function validateCqrsPatterns(
  projectPath: string,
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = []
  const suggestions: string[] = []

  const srcPath = path.join(projectPath, 'src')
  if (!fs.existsSync(srcPath)) {
    return {
      valid: false,
      issues: [
        {
          severity: 'error',
          message: 'No src directory found. Is this an MBC CQRS project?',
        },
      ],
      suggestions: ['Run "mbc new <project-name>" to create a new project'],
    }
  }

  // Check for package.json with @mbc-cqrs-serverless/core dependency
  const packageJsonPath = path.join(projectPath, 'package.json')
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies }
    if (!deps['@mbc-cqrs-serverless/core']) {
      issues.push({
        severity: 'warning',
        message: '@mbc-cqrs-serverless/core is not in dependencies',
        file: 'package.json',
      })
      suggestions.push(
        'Run "npm install @mbc-cqrs-serverless/core" to add the framework',
      )
    }
  }

  // Check for entities extending proper base classes
  const entityFiles = await findFiles(srcPath, '.entity.ts')
  for (const file of entityFiles) {
    const content = fs.readFileSync(file, 'utf-8')
    if (!content.includes('CommandEntity') && !content.includes('DataEntity')) {
      issues.push({
        severity: 'warning',
        message: 'Entity does not extend CommandEntity or DataEntity',
        file: path.relative(projectPath, file),
      })
      suggestions.push(
        `Consider extending CommandEntity or DataEntity in ${path.basename(file)}`,
      )
    }
  }

  // Check for modules with proper command module registration
  const moduleFiles = await findFiles(srcPath, '.module.ts')
  for (const file of moduleFiles) {
    const content = fs.readFileSync(file, 'utf-8')
    if (
      content.includes('@Module') &&
      !content.includes('CommandModule') &&
      !content.includes('AppModule')
    ) {
      if (content.includes('Controller') || content.includes('Service')) {
        issues.push({
          severity: 'info',
          message: 'Module does not import CommandModule',
          file: path.relative(projectPath, file),
        })
      }
    }
  }

  // Check for services using proper patterns
  const serviceFiles = await findFiles(srcPath, '.service.ts')
  for (const file of serviceFiles) {
    const content = fs.readFileSync(file, 'utf-8')
    if (content.includes('CommandService') || content.includes('DataService')) {
      // Good - using CQRS services
    } else if (
      content.includes('Repository') ||
      content.includes('getRepository')
    ) {
      issues.push({
        severity: 'info',
        message:
          'Service uses Repository directly instead of CommandService/DataService',
        file: path.relative(projectPath, file),
      })
      suggestions.push(
        'Consider using CommandService for write operations and DataService for read operations',
      )
    }
  }

  // Check for proper DTO usage
  const dtoFiles = await findFiles(srcPath, '.dto.ts')
  if (dtoFiles.length === 0) {
    issues.push({
      severity: 'info',
      message: 'No DTO files found',
    })
    suggestions.push(
      'Consider creating DTOs for request/response validation using class-validator decorators',
    )
  }

  return {
    valid: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
    suggestions,
  }
}

async function findFiles(dir: string, suffix: string): Promise<string[]> {
  const files: string[] = []

  if (!fs.existsSync(dir)) {
    return files
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (
      entry.isDirectory() &&
      entry.name !== 'node_modules' &&
      entry.name !== 'dist'
    ) {
      files.push(...(await findFiles(fullPath, suffix)))
    } else if (entry.isFile() && entry.name.endsWith(suffix)) {
      files.push(fullPath)
    }
  }

  return files
}

function formatValidationResult(result: ValidationResult): {
  content: { type: 'text'; text: string }[]
  isError?: boolean
} {
  let text = result.valid
    ? '## Validation Passed\n\n'
    : '## Validation Failed\n\n'

  if (result.issues.length > 0) {
    text += '### Issues Found\n\n'
    for (const issue of result.issues) {
      const icon =
        issue.severity === 'error'
          ? 'X'
          : issue.severity === 'warning'
            ? '!'
            : 'i'
      const location = issue.file
        ? ` (${issue.file}${issue.line ? `:${issue.line}` : ''})`
        : ''
      text += `[${icon}] ${issue.message}${location}\n`
    }
    text += '\n'
  }

  if (result.suggestions.length > 0) {
    text += '### Suggestions\n\n'
    for (const suggestion of result.suggestions) {
      text += `- ${suggestion}\n`
    }
  }

  return {
    content: [{ type: 'text', text }],
    isError: !result.valid,
  }
}
