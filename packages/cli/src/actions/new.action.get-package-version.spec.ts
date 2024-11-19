import { execSync } from 'child_process'

import { exportsForTesting } from './new.action'

const { getPackageVersion } = exportsForTesting

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}))

describe('getPackageVersion', () => {
  const mockExecSync = execSync as jest.MockedFunction<typeof execSync>
  const packageName = '@mbc-cqrs-serverless/core'

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should return the latest version when isLatest is true', () => {
    const mockLatestVersion = '1.2.3'
    mockExecSync.mockReturnValue(Buffer.from(`${mockLatestVersion}\n`))

    const result = getPackageVersion(packageName, true)

    expect(mockExecSync).toHaveBeenCalledWith(
      `npm view ${packageName} dist-tags.latest`,
    )
    expect(result).toEqual([mockLatestVersion])
  })

  it('should return all versions when isLatest is false', () => {
    const mockVersions = ['1.0.0', '1.1.0', '1.2.0']
    mockExecSync.mockReturnValue(Buffer.from(JSON.stringify(mockVersions)))

    const result = getPackageVersion(packageName, false)

    expect(mockExecSync).toHaveBeenCalledWith(
      `npm view ${packageName} versions --json`,
    )
    expect(result).toEqual(mockVersions)
  })
})
