import { execSync } from 'child_process'

import { exportsForTesting } from './new.action'

const { isLatestCli } = exportsForTesting

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}))

jest.mock('fs', () => ({
  readFileSync: jest.fn(() => JSON.stringify({ version: '1.0.0' })),
}))
jest.mock('path', () => ({
  join: jest.fn(() => '/mocked/path/to/package.json'),
}))

describe('isLatestCli', () => {
  const mockExecSync = execSync as jest.MockedFunction<typeof execSync>

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should return true if the current version matches the latest version', () => {
    const mockLatestVersion = ['1.0.0']
    mockExecSync.mockReturnValue(Buffer.from(`${mockLatestVersion}\n`))

    // Run the function
    const result = isLatestCli()

    // Assert that the result is true
    expect(result).toBe(true)
  })

  it('should return false if the current version does not match the latest version', () => {
    const mockLatestVersion = ['1.2.3']
    mockExecSync.mockReturnValue(Buffer.from(`${mockLatestVersion}\n`))

    // Run the function
    const result = isLatestCli()

    // Assert that the result is true
    expect(result).toBe(false)
  })
})
