import * as fs from 'fs'
import * as path from 'path'
import { Resource } from '@modelcontextprotocol/sdk/types.js'

/**
 * Error catalog resources for MBC CQRS Serverless framework.
 */

export function getErrorResources(): Resource[] {
  return [
    {
      uri: 'mbc://docs/errors',
      name: 'Error Catalog',
      description: 'Comprehensive catalog of common errors, their causes, and solutions',
      mimeType: 'text/markdown',
    },
  ]
}

export async function readErrorCatalog(uri: string): Promise<{ contents: { uri: string; mimeType: string; text: string }[] }> {
  // Use MBC_PROJECT_PATH environment variable or current working directory
  // プロジェクトパスは環境変数MBC_PROJECT_PATHまたはカレントディレクトリを使用
  const projectRoot = process.env.MBC_PROJECT_PATH || process.cwd()

  if (uri !== 'mbc://docs/errors') {
    throw new Error(`Unknown error resource: ${uri}`)
  }

  let content: string
  try {
    content = fs.readFileSync(path.join(projectRoot, 'docs', 'ERROR_CATALOG.md'), 'utf-8')
  } catch (error) {
    content = 'Error catalog not found. Please ensure docs/ERROR_CATALOG.md exists in your project.'
  }

  return {
    contents: [
      {
        uri,
        mimeType: 'text/markdown',
        text: content,
      },
    ],
  }
}
