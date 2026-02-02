import { Resource } from '@modelcontextprotocol/sdk/types.js'
import { getDocumentationResources, readDocumentation } from './documentation.js'
import { getErrorResources, readErrorCatalog } from './errors.js'
import { getProjectResources, readProjectResource } from './project.js'

/**
 * Register all available resources.
 */
export function registerResources(): Resource[] {
  return [
    ...getDocumentationResources(),
    ...getErrorResources(),
    ...getProjectResources(),
  ]
}

/**
 * Handle resource read requests.
 */
export async function handleResourceRead(
  uri: string,
  projectPath: string
): Promise<{ contents: { uri: string; mimeType: string; text: string }[] }> {
  if (uri.startsWith('mbc://docs/errors')) {
    return readErrorCatalog(uri)
  }

  if (uri.startsWith('mbc://docs/')) {
    return readDocumentation(uri)
  }

  if (uri.startsWith('mbc://project/')) {
    return readProjectResource(uri, projectPath)
  }

  throw new Error(`Unknown resource URI: ${uri}`)
}
