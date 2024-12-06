import { readFileSync, writeFileSync } from 'fs'

import { exportsForTesting } from './new.action'

const { updateEnvLocal } = exportsForTesting

jest.mock('fs')

describe('updateEnvLocal', () => {
  const mockEnvContent = `
      # name of application
      APP_NAME=%%projectName%%
      # name of docker compose
      COMPOSE_PROJECT_NAME=%%projectName%%
      `

  const envPath = './.env.local'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should update the specified value in the .env.local file', () => {
    const searchValue = '%%projectName%%'
    const replaceValue = 'new-project-name'

    ;(readFileSync as jest.Mock).mockReturnValue(mockEnvContent)

    updateEnvLocal(envPath, searchValue, replaceValue)

    expect(readFileSync).toHaveBeenCalledWith(envPath, 'utf8')

    const expectedContent = mockEnvContent.replaceAll(searchValue, replaceValue)
    expect(writeFileSync).toHaveBeenCalledWith(envPath, expectedContent)
  })

  it('should not change the file content if searchValue is not found', () => {
    const searchValue = 'non-existent-value'
    const replaceValue = 'new-project-name'

    ;(readFileSync as jest.Mock).mockReturnValue(mockEnvContent)

    updateEnvLocal(envPath, searchValue, replaceValue)

    expect(readFileSync).toHaveBeenCalledWith(envPath, 'utf8')

    expect(writeFileSync).toHaveBeenCalledWith(envPath, mockEnvContent)
  })
})
