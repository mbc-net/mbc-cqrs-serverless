import { existsSync } from 'fs'
import { join, posix } from 'path'

import { localBinExists, loadLocalBinCommandLoader } from './local-binaries'

jest.mock('fs')
jest.mock('path')

describe('Local Binaries Utilities', () => {
  const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>
  const mockJoin = join as jest.MockedFunction<typeof join>
  const mockPosixJoin = posix.join as jest.MockedFunction<typeof posix.join>

  beforeEach(() => {
    jest.clearAllMocks()
    mockJoin.mockImplementation((...args) => args.join('/'))
    mockPosixJoin.mockImplementation((...args) => args.join('/'))
  })

  describe('Overview: Local binary detection and loading functionality', () => {
    describe('Purpose: Test localBinExists function', () => {
      it('should return true when local binary exists', () => {
        mockExistsSync.mockReturnValue(true)

        const result = localBinExists()

        expect(result).toBe(true)
        expect(mockExistsSync).toHaveBeenCalledWith(
          expect.stringContaining('node_modules/@mbc-cqrs-serverless/cli')
        )
      })

      it('should return false when local binary does not exist', () => {
        mockExistsSync.mockReturnValue(false)

        const result = localBinExists()

        expect(result).toBe(false)
        expect(mockExistsSync).toHaveBeenCalledWith(
          expect.stringContaining('node_modules/@mbc-cqrs-serverless/cli')
        )
      })

      it('should handle file system errors gracefully', () => {
        mockExistsSync.mockImplementation(() => {
          throw new Error('File system error')
        })

        expect(() => localBinExists()).toThrow('File system error')
      })
    })

    describe('Purpose: Test loadLocalBinCommandLoader function', () => {
      it('should successfully load command loader when binary exists', () => {
        const mockCommandLoader = {
          loadCommands: jest.fn(),
          getCommand: jest.fn()
        }

        jest.doMock('node_modules/@mbc-cqrs-serverless/cli/dist/commands', () => mockCommandLoader, { virtual: true })

        const result = loadLocalBinCommandLoader()

        expect(result).toBeDefined()
        expect(mockPosixJoin).toHaveBeenCalledWith(
          expect.any(String),
          'node_modules',
          '@mbc-cqrs-serverless',
          'cli',
          'dist',
          'commands'
        )
      })

      it('should handle missing command loader module', () => {
        jest.doMock('node_modules/@mbc-cqrs-serverless/cli/dist/commands', () => {
          throw new Error('Module not found')
        }, { virtual: true })

        expect(() => loadLocalBinCommandLoader()).not.toThrow()
      })

      it('should handle corrupted command loader module', () => {
        jest.doMock('node_modules/@mbc-cqrs-serverless/cli/dist/commands', () => null, { virtual: true })

        const result = loadLocalBinCommandLoader()

        expect(result).toBeDefined()
      })
    })

    describe('Purpose: Test path construction and resolution', () => {
      it('should construct correct path segments for binary detection', () => {
        mockExistsSync.mockReturnValue(true)

        localBinExists()

        expect(mockJoin).toHaveBeenCalledWith(
          process.cwd(),
          'node_modules',
          '@mbc-cqrs-serverless',
          'cli'
        )
      })

      it('should construct correct posix path for command loader', () => {
        const mockCommandLoader = {}
        jest.doMock('node_modules/@mbc-cqrs-serverless/cli/dist/commands', () => mockCommandLoader, { virtual: true })

        loadLocalBinCommandLoader()

        expect(mockPosixJoin).toHaveBeenCalledWith(
          expect.any(String),
          'node_modules',
          '@mbc-cqrs-serverless',
          'cli',
          'dist',
          'commands'
        )
      })

      it('should handle different working directories', () => {
        const originalCwd = process.cwd
        process.cwd = jest.fn().mockReturnValue('/custom/working/directory')

        mockExistsSync.mockReturnValue(true)

        localBinExists()

        expect(mockJoin).toHaveBeenCalledWith(
          expect.any(String),
          'node_modules',
          '@mbc-cqrs-serverless',
          'cli'
        )

        process.cwd = originalCwd
      })
    })

    describe('Purpose: Test error scenarios and edge cases', () => {
      it('should handle permission denied errors', () => {
        mockExistsSync.mockImplementation(() => {
          throw new Error('EACCES: permission denied')
        })

        expect(() => localBinExists()).toThrow('EACCES: permission denied')
      })

      it('should handle network drive or symlink issues', () => {
        mockExistsSync.mockImplementation(() => {
          throw new Error('ENOTDIR: not a directory')
        })

        expect(() => localBinExists()).toThrow('ENOTDIR: not a directory')
      })

      it('should handle require cache issues in command loader', () => {
        const mockCommandLoader = { cached: true }
        jest.doMock('node_modules/@mbc-cqrs-serverless/cli/dist/commands', () => mockCommandLoader, { virtual: true })

        const result1 = loadLocalBinCommandLoader()
        const result2 = loadLocalBinCommandLoader()

        expect(result1).toBe(result2)
      })
    })

    describe('Purpose: Test integration scenarios', () => {
      it('should work correctly when binary exists and command loader is available', () => {
        mockExistsSync.mockReturnValue(true)
        const mockCommandLoader = {
          loadCommands: jest.fn(),
          getCommand: jest.fn()
        }
        jest.doMock('node_modules/@mbc-cqrs-serverless/cli/dist/commands', () => mockCommandLoader, { virtual: true })

        const binaryExists = localBinExists()
        const commandLoader = loadLocalBinCommandLoader()

        expect(binaryExists).toBe(true)
        expect(commandLoader).toBeDefined()
        expect(typeof commandLoader).toBe('object')
      })

      it('should handle scenario where binary exists but command loader fails', () => {
        mockExistsSync.mockReturnValue(true)
        jest.doMock('node_modules/@mbc-cqrs-serverless/cli/dist/commands', () => {
          throw new Error('Command loader initialization failed')
        }, { virtual: true })

        const binaryExists = localBinExists()
        
        expect(binaryExists).toBe(true)
        expect(() => loadLocalBinCommandLoader()).not.toThrow()
      })
    })
  })
})
