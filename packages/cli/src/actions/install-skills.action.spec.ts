import installSkillsAction, {
  getSkillsSourcePath,
  getPersonalSkillsPath,
  getProjectSkillsPath,
  copySkills,
  getInstalledVersion,
  getPackageVersion,
  writeVersionFile,
  getLatestVersionFromRegistry,
  VERSION_FILE_NAME,
  VERSION_CACHE_FILE_NAME,
} from './install-skills.action'

jest.mock('fs')
jest.mock('os')
jest.mock('child_process')

import {
  existsSync,
  mkdirSync,
  cpSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'fs'
import { execSync } from 'child_process'
import path from 'path'
import os from 'os'

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>
const mockMkdirSync = mkdirSync as jest.MockedFunction<typeof mkdirSync>
const mockCpSync = cpSync as jest.MockedFunction<typeof cpSync>
const mockReaddirSync = readdirSync as jest.MockedFunction<typeof readdirSync>
const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>
const mockWriteFileSync = writeFileSync as jest.MockedFunction<
  typeof writeFileSync
>
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>

describe('Install Skills Action', () => {
  const mockCommand = {
    name: () => 'install-skills',
    opts: () => ({}),
  } as any

  beforeEach(() => {
    jest.clearAllMocks()
    ;(os.homedir as jest.Mock).mockReturnValue('/home/user')
    // Default mock for npm registry - returns a test version
    mockExecSync.mockReturnValue('1.0.25\n')
  })

  describe('getSkillsSourcePath', () => {
    it('should return the path to mcp-server skills directory', () => {
      // Use real path module, mock only existsSync to return true for skills path
      mockExistsSync.mockReturnValue(true)
      const sourcePath = getSkillsSourcePath()
      expect(sourcePath).toContain('skills')
    })

    it('should try multiple paths to find skills directory', () => {
      // First call returns false, second returns true
      mockExistsSync
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
      const sourcePath = getSkillsSourcePath()
      expect(sourcePath).toContain('skills')
      expect(mockExistsSync).toHaveBeenCalledTimes(3)
    })

    it('should fallback to require.resolve when file paths not found', () => {
      // All file paths return false, but require.resolve finds the package
      mockExistsSync.mockReturnValue(false)

      // In monorepo environment, require.resolve will find mcp-server
      // This tests the fallback path (lines 62-64)
      const sourcePath = getSkillsSourcePath()
      expect(sourcePath).toContain('skills')
    })
  })

  describe('getPersonalSkillsPath', () => {
    it('should return ~/.claude/skills/ path', () => {
      const personalPath = getPersonalSkillsPath()
      expect(personalPath).toContain('/home/user')
      expect(personalPath).toContain('.claude')
      expect(personalPath).toContain('skills')
    })
  })

  describe('getProjectSkillsPath', () => {
    it('should return .claude/skills/ path in current directory', () => {
      const projectPath = getProjectSkillsPath()
      expect(projectPath).toContain('.claude/skills')
    })
  })

  describe('copySkills', () => {
    const mockSourcePath = '/source/skills'
    const mockDestPath = '/dest/skills'

    beforeEach(() => {
      mockReaddirSync.mockReturnValue([
        { name: 'mbc-generate', isDirectory: () => true },
        { name: 'mbc-review', isDirectory: () => true },
        { name: 'mbc-migrate', isDirectory: () => true },
        { name: 'mbc-debug', isDirectory: () => true },
      ] as any)
    })

    it('should create destination directory if it does not exist', () => {
      mockExistsSync.mockReturnValue(false)

      copySkills(mockSourcePath, mockDestPath)

      expect(mockMkdirSync).toHaveBeenCalledWith(mockDestPath, {
        recursive: true,
      })
    })

    it('should not create destination directory if it exists', () => {
      mockExistsSync.mockReturnValue(true)

      copySkills(mockSourcePath, mockDestPath)

      expect(mockMkdirSync).not.toHaveBeenCalled()
    })

    it('should copy all skill directories', () => {
      mockExistsSync.mockReturnValue(true)

      copySkills(mockSourcePath, mockDestPath)

      expect(mockCpSync).toHaveBeenCalledTimes(4)
      expect(mockCpSync).toHaveBeenCalledWith(
        expect.stringContaining('mbc-generate'),
        expect.stringContaining('mbc-generate'),
        { recursive: true },
      )
      expect(mockCpSync).toHaveBeenCalledWith(
        expect.stringContaining('mbc-review'),
        expect.stringContaining('mbc-review'),
        { recursive: true },
      )
      expect(mockCpSync).toHaveBeenCalledWith(
        expect.stringContaining('mbc-migrate'),
        expect.stringContaining('mbc-migrate'),
        { recursive: true },
      )
      expect(mockCpSync).toHaveBeenCalledWith(
        expect.stringContaining('mbc-debug'),
        expect.stringContaining('mbc-debug'),
        { recursive: true },
      )
    })

    it('should return the list of copied skills', () => {
      mockExistsSync.mockReturnValue(true)

      const copiedSkills = copySkills(mockSourcePath, mockDestPath)

      expect(copiedSkills).toEqual([
        'mbc-generate',
        'mbc-review',
        'mbc-migrate',
        'mbc-debug',
      ])
    })
  })

  describe('installSkillsAction', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true)
      mockReaddirSync.mockReturnValue([
        { name: 'mbc-generate', isDirectory: () => true },
        { name: 'mbc-review', isDirectory: () => true },
        { name: 'mbc-migrate', isDirectory: () => true },
        { name: 'mbc-debug', isDirectory: () => true },
      ] as any)
    })

    describe('Personal installation (default)', () => {
      it('should install skills to personal directory by default', async () => {
        const options = {}

        await installSkillsAction(options, mockCommand)

        expect(mockCpSync).toHaveBeenCalled()
      })

      it('should install to ~/.claude/skills/', async () => {
        const options = {}

        await installSkillsAction(options, mockCommand)

        expect(mockCpSync).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining('/home/user/.claude/skills'),
          expect.any(Object),
        )
      })
    })

    describe('Project installation (--project flag)', () => {
      it('should install skills to project directory when --project is specified', async () => {
        const options = { project: true }

        await installSkillsAction(options, mockCommand)

        expect(mockCpSync).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining('.claude/skills'),
          expect.any(Object),
        )
      })
    })

    describe('Error handling', () => {
      it('should handle missing source directory after finding path', async () => {
        // Source path is found, but verification fails
        mockExistsSync
          .mockReturnValueOnce(true) // getSkillsSourcePath finds it
          .mockReturnValueOnce(false) // but verification fails

        await expect(
          installSkillsAction({}, mockCommand),
        ).rejects.toThrow('Skills source directory not found')
      })

      it('should handle undefined command', async () => {
        mockExistsSync.mockReturnValue(true)
        await expect(
          installSkillsAction({}, undefined as any),
        ).rejects.toThrow('Command is required')
      })
    })

    describe('Force option', () => {
      it('should overwrite existing skills when --force is specified', async () => {
        const options = { force: true }
        mockExistsSync.mockReturnValue(true)

        await installSkillsAction(options, mockCommand)

        expect(mockCpSync).toHaveBeenCalled()
      })
    })

    describe('List option', () => {
      it('should list available skills when --list is specified', async () => {
        const options = { list: true }

        await installSkillsAction(options, mockCommand)

        // Should not copy when just listing
        expect(mockCpSync).not.toHaveBeenCalled()
      })
    })
  })

  describe('Integration scenarios', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true)
      mockReaddirSync.mockReturnValue([
        { name: 'mbc-generate', isDirectory: () => true },
        { name: 'mbc-review', isDirectory: () => true },
        { name: 'mbc-migrate', isDirectory: () => true },
        { name: 'mbc-debug', isDirectory: () => true },
      ] as any)
    })

    it('should handle installation to non-existent directory', async () => {
      mockExistsSync.mockImplementation((p: any) => {
        if (p.includes('mcp-server/skills')) return true
        return false
      })

      await installSkillsAction({}, mockCommand)

      expect(mockMkdirSync).toHaveBeenCalled()
    })

    it('should handle multiple concurrent installations', async () => {
      const promises = [
        installSkillsAction({}, mockCommand),
        installSkillsAction({ project: true }, mockCommand),
      ]

      await expect(Promise.all(promises)).resolves.not.toThrow()
    })
  })

  describe('Version management', () => {
    describe('getInstalledVersion', () => {
      it('should return null if version file does not exist', () => {
        mockExistsSync.mockReturnValue(false)

        const version = getInstalledVersion('/dest/skills')

        expect(version).toBeNull()
      })

      it('should return version from version file', () => {
        mockExistsSync.mockReturnValue(true)
        mockReadFileSync.mockReturnValue('1.0.24')

        const version = getInstalledVersion('/dest/skills')

        expect(version).toBe('1.0.24')
      })

      it('should trim whitespace from version', () => {
        mockExistsSync.mockReturnValue(true)
        mockReadFileSync.mockReturnValue('  1.0.24\n  ')

        const version = getInstalledVersion('/dest/skills')

        expect(version).toBe('1.0.24')
      })

      it('should return null on read error', () => {
        mockExistsSync.mockReturnValue(true)
        mockReadFileSync.mockImplementation(() => {
          throw new Error('Read error')
        })

        const version = getInstalledVersion('/dest/skills')

        expect(version).toBeNull()
      })
    })

    describe('getPackageVersion', () => {
      it('should return version from package.json', () => {
        mockExistsSync.mockReturnValue(true)
        mockReadFileSync.mockReturnValue(
          JSON.stringify({ version: '1.0.25' }),
        )

        const version = getPackageVersion('/source/skills')

        expect(version).toBe('1.0.25')
      })

      it('should return null if package.json does not exist', () => {
        mockExistsSync.mockReturnValue(false)

        const version = getPackageVersion('/source/skills')

        expect(version).toBeNull()
      })

      it('should return null on parse error', () => {
        mockExistsSync.mockReturnValue(true)
        mockReadFileSync.mockReturnValue('invalid json')

        const version = getPackageVersion('/source/skills')

        expect(version).toBeNull()
      })
    })

    describe('writeVersionFile', () => {
      it('should write version to file', () => {
        writeVersionFile('/dest/skills', '1.0.25')

        expect(mockWriteFileSync).toHaveBeenCalledWith(
          expect.stringContaining(VERSION_FILE_NAME),
          '1.0.25',
          'utf-8',
        )
      })
    })

    describe('getLatestVersionFromRegistry', () => {
      it('should fetch version from npm registry', () => {
        mockExistsSync.mockReturnValue(false)
        mockExecSync.mockReturnValue('1.0.26\n')

        const version = getLatestVersionFromRegistry('/dest/skills')

        expect(version).toBe('1.0.26')
        expect(mockExecSync).toHaveBeenCalledWith(
          'npm view @mbc-cqrs-serverless/mcp-server version',
          expect.objectContaining({ encoding: 'utf-8', timeout: 10000 }),
        )
      })

      it('should use cached version if cache is valid', () => {
        const cacheData = {
          version: '1.0.25',
          checkedAt: new Date().toISOString(), // Fresh cache
        }
        mockExistsSync.mockReturnValue(true)
        mockReadFileSync.mockReturnValue(JSON.stringify(cacheData))

        const version = getLatestVersionFromRegistry('/dest/skills')

        expect(version).toBe('1.0.25')
        expect(mockExecSync).not.toHaveBeenCalled()
      })

      it('should fetch from registry if cache is expired', () => {
        const cacheData = {
          version: '1.0.24',
          checkedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
        }
        mockExistsSync.mockReturnValue(true)
        mockReadFileSync.mockReturnValue(JSON.stringify(cacheData))
        mockExecSync.mockReturnValue('1.0.26\n')

        const version = getLatestVersionFromRegistry('/dest/skills')

        expect(version).toBe('1.0.26')
        expect(mockExecSync).toHaveBeenCalled()
      })

      it('should force refresh when forceRefresh is true', () => {
        const cacheData = {
          version: '1.0.24',
          checkedAt: new Date().toISOString(), // Fresh cache
        }
        mockExistsSync.mockReturnValue(true)
        mockReadFileSync.mockReturnValue(JSON.stringify(cacheData))
        mockExecSync.mockReturnValue('1.0.26\n')

        const version = getLatestVersionFromRegistry('/dest/skills', true)

        expect(version).toBe('1.0.26')
        expect(mockExecSync).toHaveBeenCalled()
      })

      it('should use expired cache as fallback when offline', () => {
        const cacheData = {
          version: '1.0.24',
          checkedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
        }
        mockExistsSync.mockReturnValue(true)
        mockReadFileSync.mockReturnValue(JSON.stringify(cacheData))
        mockExecSync.mockImplementation(() => {
          throw new Error('Network error')
        })

        const version = getLatestVersionFromRegistry('/dest/skills')

        expect(version).toBe('1.0.24')
      })

      it('should return null when offline and no cache exists', () => {
        mockExistsSync.mockReturnValue(false)
        mockExecSync.mockImplementation(() => {
          throw new Error('Network error')
        })

        const version = getLatestVersionFromRegistry('/dest/skills')

        expect(version).toBeNull()
      })

      it('should save version to cache after fetching', () => {
        mockExistsSync.mockReturnValue(true)
        mockExecSync.mockReturnValue('1.0.26\n')
        // Make cache read fail to trigger fetch
        mockReadFileSync.mockImplementation(() => {
          throw new Error('No cache')
        })

        getLatestVersionFromRegistry('/dest/skills')

        expect(mockWriteFileSync).toHaveBeenCalledWith(
          expect.stringContaining(VERSION_CACHE_FILE_NAME),
          expect.stringContaining('"version": "1.0.26"'),
          'utf-8',
        )
      })
    })

    describe('Check option', () => {
      beforeEach(() => {
        mockReaddirSync.mockReturnValue([
          { name: 'mbc-generate', isDirectory: () => true },
          { name: 'mbc-review', isDirectory: () => true },
        ] as any)
      })

      it('should check for updates when --check is specified', async () => {
        const options = { check: true }
        mockExistsSync.mockReturnValue(true)
        mockReadFileSync
          .mockReturnValueOnce('1.0.24') // installed version
          .mockReturnValueOnce(JSON.stringify({ version: '1.0.25' })) // package version

        await installSkillsAction(options, mockCommand)

        // Should not copy when just checking
        expect(mockCpSync).not.toHaveBeenCalled()
      })

      it('should report up-to-date when versions match', async () => {
        const options = { check: true }
        mockExistsSync.mockReturnValue(true)
        mockReadFileSync
          .mockReturnValueOnce('1.0.25') // installed version
          .mockReturnValueOnce(JSON.stringify({ version: '1.0.25' })) // package version

        await installSkillsAction(options, mockCommand)

        expect(mockCpSync).not.toHaveBeenCalled()
      })

      it('should report not installed when version file does not exist', async () => {
        const options = { check: true }
        // First call for source path check, second for version file check (false)
        mockExistsSync.mockImplementation((p: any) => {
          if (p.includes('mcp-server/skills') || p.includes('mcp-server\\skills')) {
            return true
          }
          if (p.includes(VERSION_FILE_NAME)) {
            return false
          }
          return true
        })
        mockReadFileSync.mockReturnValue(JSON.stringify({ version: '1.0.25' }))

        await installSkillsAction(options, mockCommand)

        expect(mockCpSync).not.toHaveBeenCalled()
      })

      it('should handle unknown package version', async () => {
        const options = { check: true }
        mockExistsSync.mockImplementation((p: any) => {
          // Package.json does not exist
          if (p.includes('package.json')) {
            return false
          }
          return true
        })
        mockReadFileSync.mockReturnValue('1.0.24') // installed version only

        await installSkillsAction(options, mockCommand)

        expect(mockCpSync).not.toHaveBeenCalled()
      })
    })

    describe('Version file creation during installation', () => {
      beforeEach(() => {
        mockExistsSync.mockReturnValue(true)
        mockReaddirSync.mockReturnValue([
          { name: 'mbc-generate', isDirectory: () => true },
        ] as any)
        mockReadFileSync.mockReturnValue(JSON.stringify({ version: '1.0.25' }))
      })

      it('should create version file after installation', async () => {
        await installSkillsAction({}, mockCommand)

        expect(mockWriteFileSync).toHaveBeenCalledWith(
          expect.stringContaining(VERSION_FILE_NAME),
          '1.0.25',
          'utf-8',
        )
      })
    })
  })
})
