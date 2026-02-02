import { Resource } from '@modelcontextprotocol/sdk/types.js'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Project-specific resources for analyzing user's MBC CQRS projects.
 */

export function getProjectResources(): Resource[] {
  return [
    {
      uri: 'mbc://project/entities',
      name: 'Project Entities',
      description: 'List of entities defined in the current project',
      mimeType: 'application/json',
    },
    {
      uri: 'mbc://project/modules',
      name: 'Project Modules',
      description: 'List of modules defined in the current project',
      mimeType: 'application/json',
    },
    {
      uri: 'mbc://project/structure',
      name: 'Project Structure',
      description: 'Overview of the project directory structure',
      mimeType: 'text/plain',
    },
  ]
}

export async function readProjectResource(
  uri: string,
  projectPath: string,
): Promise<{ contents: { uri: string; mimeType: string; text: string }[] }> {
  switch (uri) {
    case 'mbc://project/entities':
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(await findEntities(projectPath), null, 2),
          },
        ],
      }
    case 'mbc://project/modules':
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(await findModules(projectPath), null, 2),
          },
        ],
      }
    case 'mbc://project/structure':
      return {
        contents: [
          {
            uri,
            mimeType: 'text/plain',
            text: await getProjectStructure(projectPath),
          },
        ],
      }
    default:
      throw new Error(`Unknown project resource: ${uri}`)
  }
}

async function findEntities(
  projectPath: string,
): Promise<{ name: string; path: string }[]> {
  const entities: { name: string; path: string }[] = []
  const srcPath = path.join(projectPath, 'src')

  if (!fs.existsSync(srcPath)) {
    return entities
  }

  await findFilesRecursive(srcPath, (filePath) => {
    if (filePath.endsWith('.entity.ts')) {
      const relativePath = path.relative(projectPath, filePath)
      const content = fs.readFileSync(filePath, 'utf-8')
      const classMatch = content.match(/export\s+class\s+(\w+)/)
      if (classMatch) {
        entities.push({
          name: classMatch[1],
          path: relativePath,
        })
      }
    }
  })

  return entities
}

async function findModules(
  projectPath: string,
): Promise<{ name: string; path: string }[]> {
  const modules: { name: string; path: string }[] = []
  const srcPath = path.join(projectPath, 'src')

  if (!fs.existsSync(srcPath)) {
    return modules
  }

  await findFilesRecursive(srcPath, (filePath) => {
    if (filePath.endsWith('.module.ts')) {
      const relativePath = path.relative(projectPath, filePath)
      const content = fs.readFileSync(filePath, 'utf-8')
      const classMatch = content.match(/export\s+class\s+(\w+Module)/)
      if (classMatch) {
        modules.push({
          name: classMatch[1],
          path: relativePath,
        })
      }
    }
  })

  return modules
}

async function findFilesRecursive(
  dir: string,
  callback: (filePath: string) => void,
): Promise<void> {
  if (!fs.existsSync(dir)) {
    return
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (
      entry.isDirectory() &&
      entry.name !== 'node_modules' &&
      entry.name !== 'dist'
    ) {
      await findFilesRecursive(fullPath, callback)
    } else if (entry.isFile()) {
      callback(fullPath)
    }
  }
}

async function getProjectStructure(projectPath: string): Promise<string> {
  const lines: string[] = []
  const srcPath = path.join(projectPath, 'src')

  if (!fs.existsSync(srcPath)) {
    return 'No src directory found. Is this an MBC CQRS Serverless project?'
  }

  lines.push(`Project: ${path.basename(projectPath)}`)
  lines.push('')
  lines.push('src/')

  await buildTree(srcPath, '  ', lines, 3)

  return lines.join('\n')
}

async function buildTree(
  dir: string,
  indent: string,
  lines: string[],
  maxDepth: number,
  currentDepth = 0,
): Promise<void> {
  if (currentDepth >= maxDepth || !fs.existsSync(dir)) {
    return
  }

  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(
      (e) =>
        e.name !== 'node_modules' &&
        e.name !== 'dist' &&
        !e.name.startsWith('.'),
    )
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1
      if (!a.isDirectory() && b.isDirectory()) return 1
      return a.name.localeCompare(b.name)
    })

  for (const entry of entries) {
    if (entry.isDirectory()) {
      lines.push(`${indent}${entry.name}/`)
      await buildTree(
        path.join(dir, entry.name),
        indent + '  ',
        lines,
        maxDepth,
        currentDepth + 1,
      )
    } else {
      lines.push(`${indent}${entry.name}`)
    }
  }
}
