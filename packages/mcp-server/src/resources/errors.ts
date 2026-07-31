import { Resource } from '@modelcontextprotocol/sdk/types.js'
import * as path from 'path'

import { readFileSafe } from '../utils/fs.js'

/**
 * Error catalog resources for MBC CQRS Serverless framework.
 */

export function getErrorResources(): Resource[] {
  return [
    {
      uri: 'mbc://docs/errors',
      name: 'Error Catalog',
      description:
        'Comprehensive catalog of common errors, their causes, and solutions',
      mimeType: 'text/markdown',
    },
  ]
}

export async function readErrorCatalog(
  uri: string,
  projectPath: string,
): Promise<{ contents: { uri: string; mimeType: string; text: string }[] }> {
  if (uri !== 'mbc://docs/errors') {
    throw new Error(`Unknown error resource: ${uri}`)
  }

  const content = readFileSafe(
    path.join(projectPath, 'docs', 'ERROR_CATALOG.md'),
  )

  return {
    contents: [{ uri, mimeType: 'text/markdown', text: content }],
  }
}
