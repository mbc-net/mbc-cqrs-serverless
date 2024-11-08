import { execSync } from 'child_process'
import { Command } from 'commander'
import { copyFileSync, cpSync, mkdirSync } from 'fs'
import path from 'path'

import newAction, { exportsForTesting } from './new.action'

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}))

jest.mock('fs', () => ({
  copyFileSync: jest.fn(),
  cpSync: jest.fn(),
  mkdirSync: jest.fn(),
  unlinkSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(() =>
    JSON.stringify({ dependencies: {}, devDependencies: {} }),
  ),
}))

describe('newAction', () => {
  const mockExecSync = execSync as jest.MockedFunction<typeof execSync>
  const mockCommand = new Command().name('new') // Mock command with name 'new'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should generate a project with the latest version when version is not specified', async () => {
    const projectName = 'test-project'
    const latestVersion = '1.2.3'
    mockExecSync
      .mockReturnValueOnce(Buffer.from(latestVersion))
      .mockReturnValue(Buffer.from(''))

    await newAction(`${projectName}`, {}, mockCommand)

    expect(execSync).toHaveBeenCalledWith(
      'npm view @mbc-cqrs-serverless/core dist-tags.latest',
    )
    expect(mkdirSync).toHaveBeenCalledWith(
      path.join(process.cwd(), projectName),
      { recursive: true },
    )
    expect(cpSync).toHaveBeenCalledWith(
      path.join(__dirname, '../../templates'),
      path.join(process.cwd(), projectName),
      { recursive: true },
    )
    expect(copyFileSync).toHaveBeenCalledTimes(3) // For .gitignore, infra/.gitignore and .env.local
    expect(mockExecSync).toHaveBeenCalledWith('git init', {
      cwd: path.join(process.cwd(), projectName),
    })
    expect(mockExecSync).toHaveBeenCalledWith('npm i', {
      cwd: path.join(process.cwd(), projectName),
    })
  })

  it('should use a specific version if specified', async () => {
    const projectName = 'test-project'
    const version = '1.0.0'
    const mockVersions = ['1.0.0', '1.1.0', '1.2.0']
    mockExecSync
      .mockReturnValueOnce(Buffer.from(JSON.stringify(mockVersions)))
      .mockReturnValue(Buffer.from(''))

    await newAction(`${projectName}@${version}`, {}, mockCommand)

    expect(execSync).toHaveBeenCalledWith(
      'npm view @mbc-cqrs-serverless/core versions --json',
    )
    expect(mkdirSync).toHaveBeenCalledWith(
      path.join(process.cwd(), projectName),
      { recursive: true },
    )
    expect(cpSync).toHaveBeenCalledWith(
      path.join(__dirname, '../../templates'),
      path.join(process.cwd(), projectName),
      { recursive: true },
    )
    expect(copyFileSync).toHaveBeenCalledTimes(3) // For .gitignore, infra/.gitignore and .env.local
    expect(mockExecSync).toHaveBeenCalledWith('git init', {
      cwd: path.join(process.cwd(), projectName),
    })
    expect(mockExecSync).toHaveBeenCalledWith('npm i', {
      cwd: path.join(process.cwd(), projectName),
    })
  })

  it('should throw an error for an invalid version', async () => {
    const projectName = 'test-project'
    const invalidVersion = '2.0.0'
    const mockVersions = ['1.0.0', '1.1.0', '1.2.0']
    mockExecSync.mockReturnValueOnce(Buffer.from(JSON.stringify(mockVersions)))

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

    await newAction(`${projectName}@${invalidVersion}`, {}, mockCommand)

    expect(execSync).toHaveBeenCalledWith(
      'npm view @mbc-cqrs-serverless/core versions --json',
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      'The specified package version does not exist. Please chose a valid version!\n',
      mockVersions,
    )
    consoleSpy.mockRestore()
  })
})
