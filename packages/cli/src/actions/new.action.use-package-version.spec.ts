import { faker } from '@faker-js/faker'
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

import { exportsForTesting } from './new.action'

const { usePackageVersion } = exportsForTesting

// create testcase for usePackageVersion function in new.action.ts file
describe('usePackageVersion', () => {
  // Work on a copy in a temporary directory. Writing package.json next to the
  // sources (src/actions) races with other suites resolving './new.action'
  // in parallel Jest workers and fails them with "Cannot find module".
  let destDir: string
  let fname: string
  const packageVersion = '1.0.0'
  const packageJson = JSON.parse(
    readFileSync(path.join(__dirname, '../../package.json')).toString(),
  )

  beforeEach(() => {
    destDir = mkdtempSync(path.join(tmpdir(), 'mbc-use-package-version-'))
    fname = path.join(destDir, 'package.json')
    copyFileSync(path.join(__dirname, '../../templates/package.json'), fname)
  })

  afterEach(() => {
    rmSync(destDir, { recursive: true, force: true })
  })

  it('it should update deps', () => {
    usePackageVersion(destDir, packageVersion)
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

    usePackageVersion(destDir, packageVersion)
    const tplPackageJson = JSON.parse(readFileSync(fname).toString())

    expect(name).toBe(tplPackageJson.name)
  })

  it('it should not update name with empty name', () => {
    const { name } = JSON.parse(readFileSync(fname).toString())

    usePackageVersion(destDir, packageVersion, '')
    const tplPackageJson = JSON.parse(readFileSync(fname).toString())

    expect(name).toBe(tplPackageJson.name)
  })

  it('it should update name', () => {
    const name = faker.word.sample()
    usePackageVersion(destDir, packageVersion, name)
    const tplPackageJson = JSON.parse(readFileSync(fname).toString())

    expect(name).toBe(tplPackageJson.name)
  })
})
