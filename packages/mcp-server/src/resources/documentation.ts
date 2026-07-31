import { Resource } from '@modelcontextprotocol/sdk/types.js'
import * as path from 'path'

import { readFileSafe } from '../utils/fs.js'

/**
 * Documentation resources for MBC CQRS Serverless framework.
 */

export function getDocumentationResources(): Resource[] {
  return [
    {
      uri: 'mbc://docs/overview',
      name: 'Framework Overview',
      description:
        'Complete documentation of MBC CQRS Serverless framework including architecture, APIs, and usage examples',
      mimeType: 'text/plain',
    },
    {
      uri: 'mbc://docs/llms-short',
      name: 'Framework Summary',
      description:
        'Concise summary of MBC CQRS Serverless framework for quick reference',
      mimeType: 'text/plain',
    },
    {
      uri: 'mbc://docs/architecture',
      name: 'Architecture Guide',
      description:
        'CQRS and Event Sourcing architecture patterns used in the framework',
      mimeType: 'text/markdown',
    },
    {
      uri: 'mbc://docs/faq',
      name: 'FAQ',
      description: 'Frequently asked questions about the framework',
      mimeType: 'text/markdown',
    },
    {
      uri: 'mbc://docs/troubleshooting',
      name: 'Troubleshooting Guide',
      description: 'Common issues and their solutions',
      mimeType: 'text/markdown',
    },
    {
      uri: 'mbc://docs/security',
      name: 'Security Best Practices',
      description: 'Security guidelines and best practices for the framework',
      mimeType: 'text/markdown',
    },
  ]
}

/**
 * Resolve the framework root directory.
 * Uses MBC_FRAMEWORK_ROOT env var when set (e.g. in production installs),
 * otherwise falls back to two directories above this package (monorepo layout).
 */
function getFrameworkRoot(): string {
  if (process.env.MBC_FRAMEWORK_ROOT) {
    return process.env.MBC_FRAMEWORK_ROOT
  }
  // dist/resources/ → dist/ → packages/mcp-server/ → packages/ → monorepo root
  return path.resolve(__dirname, '..', '..', '..', '..')
}

export async function readDocumentation(
  uri: string,
): Promise<{ contents: { uri: string; mimeType: string; text: string }[] }> {
  const frameworkRoot = getFrameworkRoot()

  let content: string
  let mimeType = 'text/plain'

  switch (uri) {
    case 'mbc://docs/overview':
      content = readFileSafe(path.join(frameworkRoot, 'llms-full.txt'))
      break
    case 'mbc://docs/llms-short':
      content = readFileSafe(path.join(frameworkRoot, 'llms.txt'))
      break
    case 'mbc://docs/architecture':
      content = readFileSafe(
        path.join(frameworkRoot, 'docs', 'ARCHITECTURE.md'),
      )
      mimeType = 'text/markdown'
      break
    case 'mbc://docs/faq':
      content = readFileSafe(path.join(frameworkRoot, 'docs', 'FAQ.md'))
      mimeType = 'text/markdown'
      break
    case 'mbc://docs/troubleshooting':
      content = readFileSafe(
        path.join(frameworkRoot, 'docs', 'TROUBLESHOOTING.md'),
      )
      mimeType = 'text/markdown'
      break
    case 'mbc://docs/security':
      content = readFileSafe(path.join(frameworkRoot, 'SECURITY.md'))
      mimeType = 'text/markdown'
      break
    default:
      throw new Error(`Unknown documentation resource: ${uri}`)
  }

  return {
    contents: [{ uri, mimeType, text: content }],
  }
}
