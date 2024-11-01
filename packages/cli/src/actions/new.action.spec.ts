import { faker } from '@faker-js/faker'
import { copyFileSync, readFileSync, unlinkSync } from 'fs'
import path from 'path'

import { exportsForTesting } from './new.action'

const { usePackageVersion } = exportsForTesting

// create testcase for usePackageVersion function in new.action.ts file
describe('usePackageVersion', () => {
  const fname = path.join(__dirname, 'package.json')
  const packageVersion = '1.0.0'
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
    usePackageVersion(__dirname, packageVersion)
    const tplPackageJson = JSON.parse(readFileSync(fname).toString())

    expect(tplPackageJson.dependencies['@mbc-cqrs-serverless/core']).toBe(
      packageVersion,
    )
    expect(packageJson.version).toBe(
      tplPackageJson.devDependencies['@mbc-cqrs-serverless/cli'],
    )
  })

  it('it should not update name', () => {
    const { name } = JSON.parse(readFileSync(fname).toString())

    usePackageVersion(__dirname, packageVersion)
    const tplPackageJson = JSON.parse(readFileSync(fname).toString())

    expect(name).toBe(tplPackageJson.name)
  })

  it('it should not update name with empty name', () => {
    const { name } = JSON.parse(readFileSync(fname).toString())

    usePackageVersion(__dirname, packageVersion, '')
    const tplPackageJson = JSON.parse(readFileSync(fname).toString())

    expect(name).toBe(tplPackageJson.name)
  })

  it('it should update name', () => {
    const name = faker.word.sample()
    usePackageVersion(__dirname, packageVersion, name)
    const tplPackageJson = JSON.parse(readFileSync(fname).toString())

    expect(name).toBe(tplPackageJson.name)
  })
})
