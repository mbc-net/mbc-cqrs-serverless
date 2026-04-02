import * as fs from 'fs'
import * as path from 'path'

/**
 * Recursively find files ending with the given suffix,
 * skipping node_modules and dist directories.
 */
export async function findFiles(
  dir: string,
  suffix: string,
): Promise<string[]> {
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

/**
 * Read a file safely, returning a fallback message on error.
 */
export function readFileSafe(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return `Error reading file: ${filePath}. File may not exist.`
  }
}
