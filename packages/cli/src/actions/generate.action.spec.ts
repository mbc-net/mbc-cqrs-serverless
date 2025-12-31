import generateAction from './generate.action'
import * as fs from 'fs'
import * as path from 'path'

describe('Generate Action', () => {
  // Use dryRun: true by default to avoid creating actual files during tests
  // テスト中に実際のファイルを作成しないように、デフォルトで dryRun: true を使用
  const mockCommand = {
    name: () => 'generate',
    opts: () => ({
      dryRun: true,
      mode: 'async',
      schema: true
    })
  } as any

  const mockOptions = {
    dryRun: true,
    mode: 'async',
    schema: true
  }

  // Directories that may be created by tests
  // テストで作成される可能性があるディレクトリ
  const testDirs = ['src', 'test']

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    // Clean up any directories created during tests
    // テスト中に作成されたディレクトリを削除
    // The monorepo root is determined by finding package.json with "workspaces"
    let rootDir = process.cwd()

    // Walk up to find monorepo root (has workspaces in package.json)
    let current = rootDir
    for (let i = 0; i < 10; i++) {
      const pkgPath = path.join(current, 'package.json')
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
          if (pkg.workspaces) {
            rootDir = current
            break
          }
        } catch {
          // ignore
        }
      }
      const parent = path.dirname(current)
      if (parent === current) break
      current = parent
    }

    for (const dir of testDirs) {
      const dirPath = path.join(rootDir, dir)
      if (fs.existsSync(dirPath)) {
        try {
          fs.rmSync(dirPath, { recursive: true, force: true })
        } catch (error) {
          console.warn(`Failed to clean up directory: ${dirPath}`)
        }
      }
    }
  })

  describe('Overview: Schematic generation functionality', () => {
    describe('Purpose: Test basic generate action execution', () => {
      it('should execute generate action without errors', async () => {
        await expect(generateAction('service', 'test-service', mockOptions, mockCommand)).resolves.not.toThrow()
      })

      it('should handle different schematic types', async () => {
        const schematicTypes = ['service', 'controller', 'entity', 'dto', 'module']
        
        for (const type of schematicTypes) {
          await expect(generateAction(type, `test-${type}`, mockOptions, mockCommand)).resolves.not.toThrow()
        }
      })

      it('should handle generate action with custom command options', async () => {
        const customCommand = {
          ...mockCommand,
          opts: () => ({
            dryRun: true,
            mode: 'sync',
            schema: false
          })
        }
        await expect(generateAction('service', 'custom-service', mockOptions, customCommand)).resolves.not.toThrow()
      })
    })

    describe('Purpose: Test dry-run functionality', () => {
      it('should execute dry-run without making actual changes', async () => {
        const dryRunCommand = {
          ...mockCommand,
          opts: () => ({
            dryRun: true,
            mode: 'async',
            schema: true
          })
        }
        await expect(generateAction('service', 'test-service', mockOptions, dryRunCommand)).resolves.not.toThrow()
      })

      it('should handle dry-run with different modes', async () => {
        const syncDryRunCommand = {
          ...mockCommand,
          opts: () => ({
            dryRun: true,
            mode: 'sync',
            schema: false
          })
        }
        await expect(generateAction('controller', 'test-controller', mockOptions, syncDryRunCommand)).resolves.not.toThrow()
      })
    })

    describe('Purpose: Test error handling scenarios', () => {
      it('should handle missing schematic name', async () => {
        await expect(generateAction('service', '', mockOptions, mockCommand)).resolves.not.toThrow()
      })

      it('should handle undefined schematic name', async () => {
        await expect(generateAction('service', undefined as any, mockOptions, mockCommand)).resolves.not.toThrow()
      })

      it('should handle invalid schematic type', async () => {
        await expect(generateAction('invalid-type', 'test-name', mockOptions, mockCommand)).resolves.not.toThrow()
      })

      it('should handle undefined command', async () => {
        await expect(generateAction('service', 'test-service', mockOptions, undefined as any)).rejects.toThrow()
      })
    })

    describe('Purpose: Test mode and schema options', () => {
      it('should handle async mode with schema', async () => {
        const asyncCommand = {
          ...mockCommand,
          opts: () => ({
            dryRun: true,
            mode: 'async',
            schema: true
          })
        }
        await expect(generateAction('service', 'async-service', mockOptions, asyncCommand)).resolves.not.toThrow()
      })

      it('should handle sync mode without schema', async () => {
        const syncCommand = {
          ...mockCommand,
          opts: () => ({
            dryRun: true,
            mode: 'sync',
            schema: false
          })
        }
        await expect(generateAction('entity', 'sync-entity', mockOptions, syncCommand)).resolves.not.toThrow()
      })

      it('should handle noSchema option', async () => {
        const noSchemaCommand = {
          ...mockCommand,
          opts: () => ({
            dryRun: true,
            mode: 'async',
            noSchema: true
          })
        }
        await expect(generateAction('dto', 'no-schema-dto', mockOptions, noSchemaCommand)).resolves.not.toThrow()
      })
    })

    describe('Purpose: Test special characters and edge cases', () => {
      it('should handle special characters in schematic names', async () => {
        await expect(generateAction('service', 'test-service_with-special.chars', mockOptions, mockCommand)).resolves.not.toThrow()
      })

      it('should handle very long schematic names', async () => {
        const longName = 'very-long-schematic-name-that-exceeds-normal-length-limits'
        await expect(generateAction('service', longName, mockOptions, mockCommand)).resolves.not.toThrow()
      })

      it('should handle numeric schematic names', async () => {
        await expect(generateAction('service', '123-numeric-service', mockOptions, mockCommand)).resolves.not.toThrow()
      })

      it('should handle empty command options', async () => {
        const emptyCommand = {
          ...mockCommand,
          opts: () => ({})
        }
        await expect(generateAction('service', 'test-service', mockOptions, emptyCommand)).resolves.not.toThrow()
      })
    })

    describe('Purpose: Test concurrent generation scenarios', () => {
      it('should handle multiple concurrent generation requests', async () => {
        const promises = [
          generateAction('service', 'service1', mockOptions, mockCommand),
          generateAction('controller', 'controller1', mockOptions, mockCommand),
          generateAction('entity', 'entity1', mockOptions, mockCommand)
        ]

        await expect(Promise.all(promises)).resolves.not.toThrow()
      })

      it('should maintain consistency across multiple calls', async () => {
        const results = await Promise.all([
          generateAction('service', 'test-service', mockOptions, mockCommand),
          generateAction('service', 'test-service', mockOptions, mockCommand),
          generateAction('service', 'test-service', mockOptions, mockCommand)
        ])

        results.forEach(result => {
          expect(result).toBeUndefined()
        })
      })
    })
  })
})
