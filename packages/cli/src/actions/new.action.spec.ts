import { faker } from '@faker-js/faker'
import { copyFileSync, readFileSync, unlinkSync } from 'fs'
import path from 'path'

import { exportsForTesting } from './new.action'

const { useLatestPackageVersion } = exportsForTesting

// create testcase for useLatestPackageVersion function in new.action.ts file
describe('useLatestPackageVersion', () => {
  const fname = path.join(__dirname, 'package.json')
  const packageJson = JSON.parse(
    readFileSync(path.join(__dirname, '../../package.json')).toString(),
  )

  beforeEach(() => {
    copyFileSync(path.join(__dirname, '../../templates/package.json'), fname)
  })

  afterEach(() => {
    unlinkSync(fname)
  })

  it('it should update deps', () => {
    useLatestPackageVersion(__dirname)
    const tplPackageJson = JSON.parse(readFileSync(fname).toString())

    expect(packageJson.devDependencies['@mbc-cqrs-sererless/core']).toBe(
      tplPackageJson.dependencies['@mbc-cqrs-sererless/core'],
    )
    expect(packageJson.version).toBe(
      tplPackageJson.devDependencies['@mbc-cqrs-sererless/cli'],
    )
  })

  it('it should not update name', () => {
    const { name } = JSON.parse(readFileSync(fname).toString())

    useLatestPackageVersion(__dirname)
    const tplPackageJson = JSON.parse(readFileSync(fname).toString())

    expect(name).toBe(tplPackageJson.name)
  })

  it('it should not update name with empty name', () => {
    const { name } = JSON.parse(readFileSync(fname).toString())

    useLatestPackageVersion(__dirname, '')
    const tplPackageJson = JSON.parse(readFileSync(fname).toString())

    expect(name).toBe(tplPackageJson.name)
  })

  it('it should update name', () => {
    const name = faker.word.sample()
    useLatestPackageVersion(__dirname, name)
    const tplPackageJson = JSON.parse(readFileSync(fname).toString())

    expect(name).toBe(tplPackageJson.name)
  })
})
