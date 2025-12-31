import { spawn, execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Generator result interface.
 */
export interface GeneratorResult {
  success: boolean
  message: string
  files?: string[]
  error?: string
}

/**
 * Generator interface for code generation abstraction.
 * Allows swapping CLI-based generation with direct schematics in the future.
 */
export interface IGenerator {
  generateModule(name: string, options?: { mode?: 'async' | 'sync' }): Promise<GeneratorResult>
  generateController(name: string): Promise<GeneratorResult>
  generateService(name: string): Promise<GeneratorResult>
  generateEntity(name: string): Promise<GeneratorResult>
  generateDto(name: string): Promise<GeneratorResult>
}

/**
 * CLI-based generator implementation.
 * Spawns mbc CLI as a subprocess to generate code.
 */
export class CliGenerator implements IGenerator {
  constructor(private readonly projectPath: string) {}

  async generateModule(name: string, options?: { mode?: 'async' | 'sync' }): Promise<GeneratorResult> {
    try {
      const preCheck = this.checkPrerequisites()
      if (!preCheck.success) return preCheck

      const args = ['generate', 'module', name]
      if (options?.mode) {
        args.push('--mode', options.mode)
      }
      return await this.runCli(args)
    } catch (error) {
      return {
        success: false,
        message: 'Failed to generate module',
        error: String(error),
      }
    }
  }

  async generateController(name: string): Promise<GeneratorResult> {
    try {
      const preCheck = this.checkPrerequisites()
      if (!preCheck.success) return preCheck
      return await this.runCli(['generate', 'controller', name])
    } catch (error) {
      return {
        success: false,
        message: 'Failed to generate controller',
        error: String(error),
      }
    }
  }

  async generateService(name: string): Promise<GeneratorResult> {
    try {
      const preCheck = this.checkPrerequisites()
      if (!preCheck.success) return preCheck
      return await this.runCli(['generate', 'service', name])
    } catch (error) {
      return {
        success: false,
        message: 'Failed to generate service',
        error: String(error),
      }
    }
  }

  async generateEntity(name: string): Promise<GeneratorResult> {
    try {
      const preCheck = this.checkPrerequisites()
      if (!preCheck.success) return preCheck
      return await this.runCli(['generate', 'entity', name])
    } catch (error) {
      return {
        success: false,
        message: 'Failed to generate entity',
        error: String(error),
      }
    }
  }

  async generateDto(name: string): Promise<GeneratorResult> {
    try {
      const preCheck = this.checkPrerequisites()
      if (!preCheck.success) return preCheck
      return await this.runCli(['generate', 'dto', name])
    } catch (error) {
      return {
        success: false,
        message: 'Failed to generate dto',
        error: String(error),
      }
    }
  }

  private checkPrerequisites(): GeneratorResult {
    // Check if CLI is installed
    const cliInstalled = this.isCliInstalled()
    if (!cliInstalled) {
      return {
        success: false,
        message: 'MBC CLI is not installed',
        error: `The @mbc-cqrs-serverless/cli package is required for code generation.

To install:
  npm install -g @mbc-cqrs-serverless/cli

Or install locally in your project:
  npm install --save-dev @mbc-cqrs-serverless/cli

After installation, the generate tools will work correctly.`,
      }
    }

    // Check if target is a valid project
    const packageJsonPath = path.join(this.projectPath, 'package.json')
    if (!fs.existsSync(packageJsonPath)) {
      return {
        success: false,
        message: 'Not a valid project directory',
        error: `No package.json found at ${this.projectPath}.

Please ensure MBC_PROJECT_PATH environment variable points to a valid MBC CQRS Serverless project, or run the MCP server from within your project directory.

To create a new project:
  mbc new my-project`,
      }
    }

    return { success: true, message: 'Prerequisites check passed' }
  }

  private isCliInstalled(): boolean {
    try {
      // Try to find mbc in PATH or local node_modules
      execSync('npx --no-install mbc --version', {
        cwd: this.projectPath,
        stdio: 'pipe',
        timeout: 5000,
      })
      return true
    } catch (error) {
      // Check if globally installed
      try {
        execSync('mbc --version', { stdio: 'pipe', timeout: 5000 })
        return true
      } catch (innerError) {
        return false
      }
    }
  }

  private async runCli(args: string[]): Promise<GeneratorResult> {
    return new Promise((resolve) => {
      const child = spawn('npx', ['mbc', ...args], {
        cwd: this.projectPath,
        shell: true,
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('close', (code) => {
        if (code === 0) {
          const files = this.extractCreatedFiles(stdout)
          resolve({
            success: true,
            message: `Successfully generated with mbc CLI`,
            files,
          })
        } else {
          // Provide helpful error messages
          let errorMessage = stderr || stdout
          if (errorMessage.includes('could not determine executable')) {
            errorMessage = `CLI not found. Please install @mbc-cqrs-serverless/cli:
  npm install -g @mbc-cqrs-serverless/cli`
          }
          resolve({
            success: false,
            message: `CLI command failed with exit code ${code}`,
            error: errorMessage,
          })
        }
      })

      child.on('error', (err) => {
        resolve({
          success: false,
          message: 'Failed to spawn CLI process',
          error: err.message,
        })
      })
    })
  }

  private extractCreatedFiles(output: string): string[] {
    const files: string[] = []
    const lines = output.split('\n')
    for (const line of lines) {
      const match = line.match(/CREATE\s+(.+)/)
      if (match) {
        files.push(match[1].trim())
      }
    }
    return files
  }
}
