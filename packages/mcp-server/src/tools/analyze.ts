import * as fs from 'fs'
import * as path from 'path'
import { Tool } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

/**
 * Analysis result interface.
 */
interface AnalysisResult {
  projectName: string
  framework: {
    detected: boolean
    version?: string
    packages: string[]
  }
  structure: {
    modules: ModuleInfo[]
    entities: EntityInfo[]
    services: number
    controllers: number
    dtos: number
  }
  cqrsPatterns: {
    commandHandlers: number
    queryHandlers: number
    eventHandlers: number
  }
}

interface ModuleInfo {
  name: string
  path: string
  imports: string[]
}

interface EntityInfo {
  name: string
  path: string
  type: 'command' | 'data' | 'unknown'
  fields: string[]
}

const AnalyzeProjectSchema = z.object({
  path: z.string().optional().describe('Path to analyze (defaults to project root)'),
})

const LookupErrorSchema = z.object({
  error_message: z.string().describe('The error message to look up'),
})

/**
 * Get all analyze tools.
 */
export function getAnalyzeTools(): Tool[] {
  return [
    {
      name: 'mbc_analyze_project',
      description: 'Analyze an MBC CQRS Serverless project structure. Returns information about modules, entities, services, and CQRS pattern usage.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to analyze (defaults to project root)',
          },
        },
      },
    },
    {
      name: 'mbc_lookup_error',
      description: 'Look up an error message in the error catalog to find its cause and solution.',
      inputSchema: {
        type: 'object',
        properties: {
          error_message: {
            type: 'string',
            description: 'The error message to look up',
          },
        },
        required: ['error_message'],
      },
    },
  ]
}

/**
 * Handle analyze tool calls.
 */
export async function handleAnalyzeTool(
  name: string,
  args: Record<string, unknown>,
  projectPath: string
): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  switch (name) {
    case 'mbc_analyze_project': {
      const parsed = AnalyzeProjectSchema.parse(args)
      const targetPath = parsed.path ? path.resolve(projectPath, parsed.path) : projectPath
      const result = await analyzeProject(targetPath)
      return formatAnalysisResult(result)
    }
    case 'mbc_lookup_error': {
      const parsed = LookupErrorSchema.parse(args)
      return await lookupError(parsed.error_message, projectPath)
    }
    default:
      return {
        content: [{ type: 'text', text: `Unknown analyze tool: ${name}` }],
        isError: true,
      }
  }
}

async function analyzeProject(projectPath: string): Promise<AnalysisResult> {
  const result: AnalysisResult = {
    projectName: path.basename(projectPath),
    framework: {
      detected: false,
      packages: [],
    },
    structure: {
      modules: [],
      entities: [],
      services: 0,
      controllers: 0,
      dtos: 0,
    },
    cqrsPatterns: {
      commandHandlers: 0,
      queryHandlers: 0,
      eventHandlers: 0,
    },
  }

  // Check package.json
  const packageJsonPath = path.join(projectPath, 'package.json')
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    result.projectName = packageJson.name || result.projectName
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies }

    const mbcPackages = Object.keys(deps).filter(k => k.startsWith('@mbc-cqrs-serverless/'))
    result.framework.packages = mbcPackages
    result.framework.detected = mbcPackages.length > 0

    if (deps['@mbc-cqrs-serverless/core']) {
      result.framework.version = deps['@mbc-cqrs-serverless/core']
    }
  }

  const srcPath = path.join(projectPath, 'src')
  if (!fs.existsSync(srcPath)) {
    return result
  }

  // Analyze modules
  const moduleFiles = await findFiles(srcPath, '.module.ts')
  for (const file of moduleFiles) {
    const content = fs.readFileSync(file, 'utf-8')
    const classMatch = content.match(/export\s+class\s+(\w+Module)/)
    if (classMatch) {
      const imports: string[] = []
      const importMatches = content.matchAll(/imports:\s*\[([\s\S]*?)\]/g)
      for (const match of importMatches) {
        const importList = match[1].split(',').map(s => s.trim()).filter(s => s)
        imports.push(...importList)
      }
      result.structure.modules.push({
        name: classMatch[1],
        path: path.relative(projectPath, file),
        imports,
      })
    }
  }

  // Analyze entities
  const entityFiles = await findFiles(srcPath, '.entity.ts')
  for (const file of entityFiles) {
    const content = fs.readFileSync(file, 'utf-8')
    const classMatch = content.match(/export\s+class\s+(\w+)/)
    if (classMatch) {
      const type: 'command' | 'data' | 'unknown' =
        content.includes('CommandEntity') ? 'command' :
        content.includes('DataEntity') ? 'data' : 'unknown'

      const fields: string[] = []
      const fieldMatches = content.matchAll(/^\s*(\w+)(?:\?)?:\s*(\w+)/gm)
      for (const match of fieldMatches) {
        if (!['constructor', 'export', 'import', 'class', 'extends', 'implements'].includes(match[1])) {
          fields.push(`${match[1]}: ${match[2]}`)
        }
      }

      result.structure.entities.push({
        name: classMatch[1],
        path: path.relative(projectPath, file),
        type,
        fields: fields.slice(0, 10),
      })
    }
  }

  // Count other files
  result.structure.services = (await findFiles(srcPath, '.service.ts')).length
  result.structure.controllers = (await findFiles(srcPath, '.controller.ts')).length
  result.structure.dtos = (await findFiles(srcPath, '.dto.ts')).length

  // Analyze CQRS patterns
  const allTsFiles = await findFiles(srcPath, '.ts')
  for (const file of allTsFiles) {
    const content = fs.readFileSync(file, 'utf-8')
    if (content.includes('@CommandHandler')) result.cqrsPatterns.commandHandlers++
    if (content.includes('@QueryHandler')) result.cqrsPatterns.queryHandlers++
    if (content.includes('@EventHandler') || content.includes('IEventHandler')) result.cqrsPatterns.eventHandlers++
  }

  return result
}

async function findFiles(dir: string, suffix: string): Promise<string[]> {
  const files: string[] = []

  if (!fs.existsSync(dir)) {
    return files
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
      files.push(...await findFiles(fullPath, suffix))
    } else if (entry.isFile() && entry.name.endsWith(suffix)) {
      files.push(fullPath)
    }
  }

  return files
}

async function lookupError(errorMessage: string, projectPath: string): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  // Use projectPath parameter which comes from MBC_PROJECT_PATH environment variable
  // プロジェクトパスはMBC_PROJECT_PATH環境変数から取得されたパスを使用
  const errorCatalogPath = path.join(projectPath, 'docs', 'ERROR_CATALOG.md')

  if (!fs.existsSync(errorCatalogPath)) {
    return {
      content: [{ type: 'text', text: 'Error catalog not found.' }],
      isError: true,
    }
  }

  const catalog = fs.readFileSync(errorCatalogPath, 'utf-8')
  const lowerError = errorMessage.toLowerCase()

  // Find matching sections
  const sections = catalog.split(/^### /gm).slice(1)
  const matches: string[] = []

  for (const section of sections) {
    const sectionLower = section.toLowerCase()
    if (sectionLower.includes(lowerError) ||
        lowerError.split(' ').some(word => word.length > 4 && sectionLower.includes(word))) {
      matches.push('### ' + section.trim())
    }
  }

  if (matches.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `No matching error found for: "${errorMessage}"\n\nTry searching with different keywords or check the full error catalog using the mbc://docs/errors resource.`,
      }],
    }
  }

  return {
    content: [{
      type: 'text',
      text: `## Error Lookup Results\n\nFound ${matches.length} matching error(s):\n\n${matches.join('\n\n---\n\n')}`,
    }],
  }
}

function formatAnalysisResult(result: AnalysisResult): { content: { type: 'text'; text: string }[] } {
  let text = `## Project Analysis: ${result.projectName}\n\n`

  // Framework info
  text += '### Framework\n\n'
  if (result.framework.detected) {
    text += `MBC CQRS Serverless detected\n`
    if (result.framework.version) {
      text += `- Core version: ${result.framework.version}\n`
    }
    text += `- Installed packages: ${result.framework.packages.join(', ')}\n`
  } else {
    text += 'MBC CQRS Serverless framework not detected\n'
  }
  text += '\n'

  // Structure summary
  text += '### Structure Summary\n\n'
  text += `- Modules: ${result.structure.modules.length}\n`
  text += `- Entities: ${result.structure.entities.length}\n`
  text += `- Services: ${result.structure.services}\n`
  text += `- Controllers: ${result.structure.controllers}\n`
  text += `- DTOs: ${result.structure.dtos}\n\n`

  // CQRS patterns
  text += '### CQRS Patterns\n\n'
  text += `- Command Handlers: ${result.cqrsPatterns.commandHandlers}\n`
  text += `- Query Handlers: ${result.cqrsPatterns.queryHandlers}\n`
  text += `- Event Handlers: ${result.cqrsPatterns.eventHandlers}\n\n`

  // Modules detail
  if (result.structure.modules.length > 0) {
    text += '### Modules\n\n'
    for (const mod of result.structure.modules) {
      text += `**${mod.name}** (${mod.path})\n`
      if (mod.imports.length > 0) {
        text += `  Imports: ${mod.imports.slice(0, 5).join(', ')}${mod.imports.length > 5 ? '...' : ''}\n`
      }
    }
    text += '\n'
  }

  // Entities detail
  if (result.structure.entities.length > 0) {
    text += '### Entities\n\n'
    for (const entity of result.structure.entities) {
      text += `**${entity.name}** [${entity.type}] (${entity.path})\n`
      if (entity.fields.length > 0) {
        text += `  Fields: ${entity.fields.slice(0, 5).join(', ')}${entity.fields.length > 5 ? '...' : ''}\n`
      }
    }
  }

  return {
    content: [{ type: 'text', text }],
  }
}
