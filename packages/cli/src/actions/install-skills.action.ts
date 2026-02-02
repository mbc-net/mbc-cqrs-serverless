import { Command } from 'commander'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'fs'
import os from 'os'
import path from 'path'

import { logger } from '../ui'

/**
 * Version file name for tracking installed skills version
 */
export const VERSION_FILE_NAME = '.mbc-skills-version'

/**
 * Get the path to the mcp-server skills source directory
 */
export function getSkillsSourcePath(): string {
  // Try to find the mcp-server package
  const possiblePaths = [
    // When installed globally or locally via npm
    path.join(
      __dirname,
      '..',
      '..',
      '..',
      'mcp-server',
      'skills',
    ),
    // When running from monorepo
    path.join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'mcp-server',
      'skills',
    ),
    // When installed via npm in node_modules
    path.join(
      process.cwd(),
      'node_modules',
      '@mbc-cqrs-serverless',
      'mcp-server',
      'skills',
    ),
  ]

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return p
    }
  }

  // Try to resolve from npm package
  try {
    const mcpServerPath = require.resolve('@mbc-cqrs-serverless/mcp-server')
    return path.join(path.dirname(mcpServerPath), '..', 'skills')
  } catch {
    // Package not found
  }

  throw new Error(
    'Could not find mcp-server skills directory. Please ensure @mbc-cqrs-serverless/mcp-server is installed.',
  )
}

/**
 * Get the path to personal skills directory (~/.claude/skills/)
 */
export function getPersonalSkillsPath(): string {
  return path.join(os.homedir(), '.claude', 'skills')
}

/**
 * Get the path to project skills directory (.claude/skills/)
 */
export function getProjectSkillsPath(): string {
  return path.join(process.cwd(), '.claude', 'skills')
}

/**
 * Copy skills from source to destination
 * @returns List of copied skill names
 */
export function copySkills(sourcePath: string, destPath: string): string[] {
  // Create destination directory if it doesn't exist
  if (!existsSync(destPath)) {
    mkdirSync(destPath, { recursive: true })
  }

  // Get all skill directories
  const entries = readdirSync(sourcePath, { withFileTypes: true })
  const skillDirs = entries.filter((entry) => entry.isDirectory())

  const copiedSkills: string[] = []

  for (const skillDir of skillDirs) {
    const skillSourcePath = path.join(sourcePath, skillDir.name)
    const skillDestPath = path.join(destPath, skillDir.name)

    cpSync(skillSourcePath, skillDestPath, { recursive: true })
    copiedSkills.push(skillDir.name)
  }

  return copiedSkills
}

/**
 * List available skills
 */
function listSkills(sourcePath: string): string[] {
  const entries = readdirSync(sourcePath, { withFileTypes: true })
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
}

/**
 * Get the installed version of skills from the version file
 * @returns The installed version or null if not found
 */
export function getInstalledVersion(destPath: string): string | null {
  const versionFilePath = path.join(destPath, VERSION_FILE_NAME)

  if (!existsSync(versionFilePath)) {
    return null
  }

  try {
    const version = readFileSync(versionFilePath, 'utf-8')
    return version.trim()
  } catch {
    return null
  }
}

/**
 * Get the package version from mcp-server package.json
 * @returns The package version or null if not found
 */
export function getPackageVersion(sourcePath: string): string | null {
  // The package.json is one level up from the skills directory
  const packageJsonPath = path.join(sourcePath, '..', 'package.json')

  if (!existsSync(packageJsonPath)) {
    return null
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
    return packageJson.version || null
  } catch {
    return null
  }
}

/**
 * Write the version file to track installed skills version
 */
export function writeVersionFile(destPath: string, version: string): void {
  const versionFilePath = path.join(destPath, VERSION_FILE_NAME)
  writeFileSync(versionFilePath, version, 'utf-8')
}

export interface InstallSkillsOptions {
  project?: boolean
  force?: boolean
  list?: boolean
  check?: boolean
}

/**
 * Install Claude Code skills for MBC CQRS Serverless
 */
export default async function installSkillsAction(
  options: InstallSkillsOptions,
  command: Command,
): Promise<void> {
  if (!command) {
    throw new Error('Command is required')
  }

  logger.info(`Executing command '${command.name()}'...`)

  const { project, force, list, check } = options

  // Get source path
  let sourcePath: string
  try {
    sourcePath = getSkillsSourcePath()
  } catch (error) {
    logger.error((error as Error).message)
    throw error
  }

  // Verify source exists
  if (!existsSync(sourcePath)) {
    const errorMsg = `Skills source directory not found: ${sourcePath}`
    logger.error(errorMsg)
    throw new Error(errorMsg)
  }

  // List mode
  if (list) {
    const skills = listSkills(sourcePath)
    logger.title('skills', 'Available Claude Code Skills:')
    skills.forEach((skill) => {
      logger.log(`  - ${skill}`)
    })
    logger.log('')
    logger.info(`Total: ${skills.length} skills`)
    return
  }

  // Determine destination path
  const destPath = project ? getProjectSkillsPath() : getPersonalSkillsPath()

  // Check mode - compare versions without installing
  if (check) {
    const installedVersion = getInstalledVersion(destPath)
    const packageVersion = getPackageVersion(sourcePath)

    if (!installedVersion) {
      logger.warn('Skills are not installed.')
      logger.info(`Available version: ${packageVersion || 'unknown'}`)
      logger.info('Run `mbc install-skills` to install.')
      return
    }

    if (!packageVersion) {
      logger.warn('Could not determine package version.')
      logger.info(`Installed version: ${installedVersion}`)
      return
    }

    if (installedVersion === packageVersion) {
      logger.success(`Skills are up to date (${installedVersion}).`)
    } else {
      logger.warn(`Update available: ${installedVersion} → ${packageVersion}`)
      logger.info('Run `mbc install-skills --force` to update.')
    }
    return
  }

  // Check if skills already exist
  if (existsSync(destPath) && !force) {
    const existingSkills = readdirSync(destPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)

    if (existingSkills.length > 0) {
      logger.warn(
        `Skills already exist at ${destPath}. Use --force to overwrite.`,
      )
    }
  }

  // Copy skills
  logger.title('install', `Installing skills to ${destPath}`)
  const copiedSkills = copySkills(sourcePath, destPath)

  // Write version file
  const packageVersion = getPackageVersion(sourcePath)
  if (packageVersion) {
    writeVersionFile(destPath, packageVersion)
  }

  logger.success(`Successfully installed ${copiedSkills.length} skills:`)
  copiedSkills.forEach((skill) => {
    logger.log(`  - ${skill}`)
  })

  if (packageVersion) {
    logger.log('')
    logger.info(`Version: ${packageVersion}`)
  }

  logger.log('')
  logger.info('You can now use these skills in Claude Code:')
  copiedSkills.forEach((skill) => {
    logger.log(`  /${skill}`)
  })
}
