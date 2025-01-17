import { existsSync } from 'fs'
import { join, posix } from 'path'

const localBinPathSegments = [
  process.cwd(),
  'node_modules',
  '@mbc-cqrs-serverless',
  'cli',
]

export function localBinExists() {
  return existsSync(join(...localBinPathSegments))
}

export function loadLocalBinCommandLoader() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const commandLoader = require(
    posix.join(...localBinPathSegments, 'dist', 'commands'),
  )
  return commandLoader
}
