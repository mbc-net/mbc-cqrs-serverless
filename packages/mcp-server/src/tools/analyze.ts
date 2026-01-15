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

const CheckAntiPatternsSchema = z.object({
  path: z.string().optional().describe('Path to check (defaults to src/)'),
})

const HealthCheckSchema = z.object({})

const ExplainCodeSchema = z.object({
  file_path: z.string().describe('Path to the file to explain'),
  start_line: z.number().optional().describe('Starting line number'),
  end_line: z.number().optional().describe('Ending line number'),
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
    {
      name: 'mbc_check_anti_patterns',
      description: 'Check the project code for common anti-patterns and bad practices. Returns a list of detected issues with locations and recommendations.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to check (defaults to src/)',
          },
        },
      },
    },
    {
      name: 'mbc_health_check',
      description: 'Perform a health check on the MBC CQRS Serverless project. Checks dependencies, structure, configuration, and common setup issues.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'mbc_explain_code',
      description: 'Analyze and explain a specific file or code section in the context of the MBC CQRS Serverless framework.',
      inputSchema: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'Path to the file to explain',
          },
          start_line: {
            type: 'number',
            description: 'Starting line number (optional)',
          },
          end_line: {
            type: 'number',
            description: 'Ending line number (optional)',
          },
        },
        required: ['file_path'],
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
    case 'mbc_check_anti_patterns': {
      const parsed = CheckAntiPatternsSchema.parse(args)
      const targetPath = parsed.path ? path.resolve(projectPath, parsed.path) : path.join(projectPath, 'src')
      return await checkAntiPatterns(targetPath, projectPath)
    }
    case 'mbc_health_check': {
      HealthCheckSchema.parse(args)
      return await healthCheck(projectPath)
    }
    case 'mbc_explain_code': {
      const parsed = ExplainCodeSchema.parse(args)
      const filePath = path.resolve(projectPath, parsed.file_path)
      return await explainCode(filePath, parsed.start_line, parsed.end_line)
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

/**
 * Anti-pattern detection interface.
 */
interface AntiPatternMatch {
  code: string
  name: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  file: string
  line: number
  snippet: string
  recommendation: string
}

/**
 * Anti-patterns to check for.
 * Codes are sequential from AP001 to AP010.
 */
const ANTI_PATTERNS = [
  {
    code: 'AP001',
    name: 'Direct DynamoDB Write',
    severity: 'critical' as const,
    pattern: /new\s+(PutItemCommand|UpdateItemCommand|DeleteItemCommand)\s*\(/,
    recommendation: 'Use CommandService.publishAsync() instead of direct DynamoDB writes to maintain CQRS pattern.',
  },
  {
    code: 'AP002',
    name: 'Ignored Version Mismatch',
    severity: 'high' as const,
    pattern: /catch\s*\([^)]*\)\s*\{[^}]*VersionMismatch[^}]*(?:console\.log|\/\/|return\s*;)/,
    recommendation: 'Handle VersionMismatchError by retrying with fresh data, not by ignoring.',
  },
  {
    code: 'AP003',
    name: 'N+1 Query Pattern',
    severity: 'high' as const,
    pattern: /for\s*\([^)]+\)\s*\{[^}]*await\s+(?:this\.)?(?:dataService|commandService)\./,
    recommendation: 'Use batch operations or pre-fetch data before the loop.',
  },
  {
    code: 'AP004',
    name: 'Full Table Scan',
    severity: 'high' as const,
    pattern: /\.scan\s*\(\s*\{[^}]*TableName/,
    recommendation: 'Use Query with proper key conditions instead of Scan.',
  },
  {
    code: 'AP005',
    name: 'Hardcoded Tenant',
    severity: 'critical' as const,
    pattern: /['"`]TENANT#\w+['"`]/,
    recommendation: 'Use getUserContext(context).tenantCode to get tenant dynamically.',
  },
  {
    code: 'AP006',
    name: 'Missing Tenant Validation',
    severity: 'critical' as const,
    pattern: /(?:dto|body|request)\s*\.\s*tenantCode/,
    recommendation: 'Never trust client-provided tenant codes. Use getUserContext() from authenticated context.',
  },
  {
    code: 'AP007',
    name: 'Throwing in Sync Handler',
    severity: 'high' as const,
    // Limit match to 500 characters to avoid false positives across distant code
    pattern: /@DataSyncHandler[\s\S]{0,500}throw\s+(?:error|new\s+\w+Error)/,
    recommendation: 'Handle errors gracefully in DataSyncHandler. Use DLQ for failed events.',
  },
  {
    code: 'AP008',
    name: 'Hardcoded Secret',
    severity: 'critical' as const,
    pattern: /(?:password|secret|apiKey|token)\s*[:=]\s*['"`][^'"`]{8,}['"`]/i,
    recommendation: 'Use environment variables or AWS Secrets Manager for sensitive values.',
  },
  {
    code: 'AP009',
    name: 'Manual JWT Parsing',
    severity: 'critical' as const,
    pattern: /atob\s*\([^)]*\.split\s*\(['"`]\.['"`]\)/,
    recommendation: 'Use the framework\'s built-in JWT validation via Cognito authorizer.',
  },
  {
    code: 'AP010',
    name: 'Heavy Module Import',
    severity: 'medium' as const,
    pattern: /^import\s+\*\s+as\s+\w+\s+from\s+['"`](?:aws-sdk|lodash|moment)['"`]/m,
    recommendation: 'Import only what you need to reduce cold start time.',
  },
]

/**
 * Check for anti-patterns in code.
 */
async function checkAntiPatterns(
  targetPath: string,
  projectPath: string
): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  if (!fs.existsSync(targetPath)) {
    return {
      content: [{ type: 'text', text: `Path not found: ${targetPath}` }],
      isError: true,
    }
  }

  const matches: AntiPatternMatch[] = []
  const skippedFiles: string[] = []
  const files = await findFiles(targetPath, '.ts')

  for (const file of files) {
    if (file.includes('.spec.') || file.includes('.test.') || file.includes('.d.ts')) {
      continue
    }

    let content: string
    try {
      content = fs.readFileSync(file, 'utf-8')
    } catch (err) {
      // Skip files that cannot be read (permission issues, etc.)
      skippedFiles.push(path.relative(projectPath, file))
      continue
    }
    const lines = content.split('\n')

    for (const ap of ANTI_PATTERNS) {
      const regex = new RegExp(ap.pattern.source, 'gm')
      let match
      while ((match = regex.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length
        const snippet = lines[lineNumber - 1]?.trim() || ''

        matches.push({
          code: ap.code,
          name: ap.name,
          severity: ap.severity,
          file: path.relative(projectPath, file),
          line: lineNumber,
          snippet: snippet.length > 80 ? snippet.substring(0, 77) + '...' : snippet,
          recommendation: ap.recommendation,
        })
      }
    }
  }

  if (matches.length === 0) {
    let text = '## Anti-Pattern Check Results\n\n✅ No anti-patterns detected! Your code follows best practices.'
    if (skippedFiles.length > 0) {
      text += `\n\n**Note:** ${skippedFiles.length} file(s) could not be read and were skipped.`
    }
    return {
      content: [{ type: 'text', text }],
    }
  }

  // Group by severity
  const critical = matches.filter(m => m.severity === 'critical')
  const high = matches.filter(m => m.severity === 'high')
  const medium = matches.filter(m => m.severity === 'medium')
  const low = matches.filter(m => m.severity === 'low')

  let text = `## Anti-Pattern Check Results\n\n`
  text += `Found **${matches.length}** potential issue(s):\n\n`
  text += `| Severity | Count |\n|----------|-------|\n`
  text += `| 🔴 Critical | ${critical.length} |\n`
  text += `| 🟠 High | ${high.length} |\n`
  text += `| 🟡 Medium | ${medium.length} |\n`
  text += `| 🟢 Low | ${low.length} |\n\n`

  for (const m of matches) {
    const icon = m.severity === 'critical' ? '🔴' : m.severity === 'high' ? '🟠' : m.severity === 'medium' ? '🟡' : '🟢'
    text += `### ${icon} ${m.code}: ${m.name}\n\n`
    text += `**File:** \`${m.file}:${m.line}\`\n`
    text += `**Snippet:** \`${m.snippet}\`\n\n`
    text += `**Recommendation:** ${m.recommendation}\n\n`
    text += `---\n\n`
  }

  if (skippedFiles.length > 0) {
    text += `**Note:** ${skippedFiles.length} file(s) could not be read and were skipped.\n`
  }

  return { content: [{ type: 'text', text }] }
}

/**
 * Health check result interface.
 */
interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'error'
  checks: {
    name: string
    status: 'pass' | 'warn' | 'fail'
    message: string
  }[]
}

/**
 * Perform health check on project.
 */
async function healthCheck(
  projectPath: string
): Promise<{ content: { type: 'text'; text: string }[] }> {
  const result: HealthCheckResult = {
    status: 'healthy',
    checks: [],
  }

  // Check package.json
  const packageJsonPath = path.join(projectPath, 'package.json')
  if (fs.existsSync(packageJsonPath)) {
    let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
    try {
      pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    } catch (err) {
      result.checks.push({
        name: 'package.json',
        status: 'fail',
        message: 'package.json exists but could not be parsed (invalid JSON)',
      })
      result.status = 'error'
      pkg = {}
    }
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }

    // Check for MBC packages
    const mbcPackages = Object.keys(deps).filter(k => k.startsWith('@mbc-cqrs-serverless/'))
    if (mbcPackages.length === 0) {
      result.checks.push({
        name: 'MBC Framework',
        status: 'fail',
        message: 'No @mbc-cqrs-serverless packages found. Is this an MBC project?',
      })
      result.status = 'error'
    } else {
      result.checks.push({
        name: 'MBC Framework',
        status: 'pass',
        message: `Found ${mbcPackages.length} package(s): ${mbcPackages.join(', ')}`,
      })
    }

    // Check for @nestjs packages
    const nestPackages = Object.keys(deps).filter(k => k.startsWith('@nestjs/'))
    if (nestPackages.length === 0) {
      result.checks.push({
        name: 'NestJS',
        status: 'fail',
        message: 'No @nestjs packages found.',
      })
      result.status = 'error'
    } else {
      result.checks.push({
        name: 'NestJS',
        status: 'pass',
        message: `Found ${nestPackages.length} NestJS package(s)`,
      })
    }

    // Check TypeScript version
    const tsVersion = deps['typescript']
    if (!tsVersion) {
      result.checks.push({
        name: 'TypeScript',
        status: 'warn',
        message: 'TypeScript not found in dependencies',
      })
      if (result.status === 'healthy') result.status = 'warning'
    } else {
      result.checks.push({
        name: 'TypeScript',
        status: 'pass',
        message: `Version: ${tsVersion}`,
      })
    }
  } else {
    result.checks.push({
      name: 'package.json',
      status: 'fail',
      message: 'package.json not found',
    })
    result.status = 'error'
  }

  // Check for .env file
  const envPath = path.join(projectPath, '.env')
  const envExamplePath = path.join(projectPath, '.env.example')
  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExamplePath)) {
      result.checks.push({
        name: 'Environment',
        status: 'warn',
        message: '.env not found, but .env.example exists. Copy and configure it.',
      })
      if (result.status === 'healthy') result.status = 'warning'
    } else {
      result.checks.push({
        name: 'Environment',
        status: 'warn',
        message: 'No .env file found',
      })
      if (result.status === 'healthy') result.status = 'warning'
    }
  } else {
    result.checks.push({
      name: 'Environment',
      status: 'pass',
      message: '.env file exists',
    })
  }

  // Check for src directory
  const srcPath = path.join(projectPath, 'src')
  if (!fs.existsSync(srcPath)) {
    result.checks.push({
      name: 'Source Directory',
      status: 'fail',
      message: 'src/ directory not found',
    })
    result.status = 'error'
  } else {
    const moduleCount = (await findFiles(srcPath, '.module.ts')).length
    result.checks.push({
      name: 'Source Directory',
      status: 'pass',
      message: `Found ${moduleCount} module(s)`,
    })
  }

  // Check for serverless.yml or serverless.ts
  const serverlessYml = path.join(projectPath, 'serverless.yml')
  const serverlessTs = path.join(projectPath, 'serverless.ts')
  if (!fs.existsSync(serverlessYml) && !fs.existsSync(serverlessTs)) {
    result.checks.push({
      name: 'Serverless Config',
      status: 'warn',
      message: 'No serverless.yml or serverless.ts found',
    })
    if (result.status === 'healthy') result.status = 'warning'
  } else {
    result.checks.push({
      name: 'Serverless Config',
      status: 'pass',
      message: fs.existsSync(serverlessYml) ? 'serverless.yml found' : 'serverless.ts found',
    })
  }

  // Format output
  const icon = result.status === 'healthy' ? '✅' : result.status === 'warning' ? '⚠️' : '❌'
  let text = `## Project Health Check ${icon}\n\n`
  text += `**Overall Status:** ${result.status.toUpperCase()}\n\n`
  text += `| Check | Status | Details |\n`
  text += `|-------|--------|--------|\n`

  for (const check of result.checks) {
    const statusIcon = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌'
    text += `| ${check.name} | ${statusIcon} | ${check.message} |\n`
  }

  return { content: [{ type: 'text', text }] }
}

/**
 * Explain code in MBC context.
 */
async function explainCode(
  filePath: string,
  startLine?: number,
  endLine?: number
): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  if (!fs.existsSync(filePath)) {
    return {
      content: [{ type: 'text', text: `File not found: ${filePath}` }],
      isError: true,
    }
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const fileName = path.basename(filePath)

  let codeSection: string
  if (startLine !== undefined && endLine !== undefined) {
    codeSection = lines.slice(startLine - 1, endLine).join('\n')
  } else {
    codeSection = content
  }

  // Detect file type and patterns
  const patterns: string[] = []
  const explanations: string[] = []

  // Module detection
  if (content.includes('@Module(')) {
    patterns.push('NestJS Module')
    if (content.includes('CommandModule')) {
      explanations.push('This module imports CommandModule, enabling CQRS command handling.')
    }
    if (content.includes('imports:')) {
      explanations.push('The imports array lists other modules this module depends on.')
    }
    if (content.includes('providers:')) {
      explanations.push('The providers array lists services and handlers available in this module.')
    }
  }

  // Controller detection
  if (content.includes('@Controller(')) {
    patterns.push('REST Controller')
    if (content.includes('@Get(')) explanations.push('Contains GET endpoint(s) for read operations.')
    if (content.includes('@Post(')) explanations.push('Contains POST endpoint(s) for create operations.')
    if (content.includes('@Patch(') || content.includes('@Put(')) {
      explanations.push('Contains PATCH/PUT endpoint(s) for update operations.')
    }
    if (content.includes('@Delete(')) explanations.push('Contains DELETE endpoint(s) for delete operations.')
  }

  // Service detection
  if (content.includes('@Injectable()') && fileName.includes('.service.')) {
    patterns.push('Service')
    if (content.includes('CommandService')) {
      explanations.push('Uses CommandService for publishing commands (state changes).')
    }
    if (content.includes('DataService')) {
      explanations.push('Uses DataService for querying data (read operations).')
    }
    if (content.includes('SequenceService')) {
      explanations.push('Uses SequenceService for generating sequential IDs.')
    }
  }

  // Entity detection
  if (fileName.includes('.entity.')) {
    patterns.push('Entity')
    if (content.includes('CommandEntity')) {
      explanations.push('This is a Command entity stored in the command table for write operations.')
    }
    if (content.includes('DataEntity')) {
      explanations.push('This is a Data entity stored in the data table for read operations.')
    }
    if (content.includes('pk:') && content.includes('sk:')) {
      explanations.push('Uses DynamoDB single-table design with partition key (pk) and sort key (sk).')
    }
  }

  // Handler detection
  if (content.includes('@DataSyncHandler(')) {
    patterns.push('Data Sync Handler')
    explanations.push('This handler reacts to DynamoDB Streams events for data synchronization.')
    explanations.push('It runs when items are created, updated, or deleted in DynamoDB.')
  }

  // CQRS patterns
  if (content.includes('publishAsync(')) {
    explanations.push('Uses publishAsync() for non-blocking command publishing.')
  }
  if (content.includes('publishSync(')) {
    explanations.push('Uses publishSync() for synchronous command execution (waits for Step Functions).')
  }
  if (content.includes('getUserContext(')) {
    explanations.push('Extracts user context (tenantCode, userId, role) from the invocation context.')
  }

  // Build output
  let text = `## Code Analysis: ${fileName}\n\n`

  if (patterns.length > 0) {
    text += `### Detected Patterns\n\n`
    for (const p of patterns) {
      text += `- ${p}\n`
    }
    text += '\n'
  }

  if (explanations.length > 0) {
    text += `### Explanation\n\n`
    for (const e of explanations) {
      text += `- ${e}\n`
    }
    text += '\n'
  }

  if (startLine !== undefined && endLine !== undefined) {
    text += `### Code Section (lines ${startLine}-${endLine})\n\n`
    text += '```typescript\n'
    text += codeSection
    text += '\n```\n'
  }

  if (patterns.length === 0 && explanations.length === 0) {
    text += 'No specific MBC CQRS patterns detected in this file.\n'
    text += 'This might be a utility file, DTO, or non-framework-specific code.\n'
  }

  return { content: [{ type: 'text', text }] }
}
