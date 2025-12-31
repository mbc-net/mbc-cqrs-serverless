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
  const frameworkRoot = path.resolve(__dirname, '../../../../..')

  if (uri !== 'mbc://docs/errors') {
    throw new Error(`Unknown error resource: ${uri}`)
  }

  let content: string
  try {
    content = fs.readFileSync(path.join(frameworkRoot, 'docs', 'ERROR_CATALOG.md'), 'utf-8')
  } catch (error) {
    content = 'Error catalog not found. Please ensure docs/ERROR_CATALOG.md exists.'
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
