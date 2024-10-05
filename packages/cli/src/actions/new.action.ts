import { execSync } from 'child_process'
import { Command } from 'commander'
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'fs'
import path from 'path'

/* eslint-disable no-console */
export default async function newAction(
  name: string = '',
  options: object,
  command: Command,
) {
  console.log(
    `Executing command '${command.name()}' for application '${name}' with options '${JSON.stringify(
      options,
    )}'`,
  )

  const destDir = path.join(process.cwd(), name)
  console.log('Generating MBC cqrs serverless application in', destDir)
  mkdirSync(destDir, { recursive: true })
  cpSync(path.join(__dirname, '../../templates'), destDir, { recursive: true })

  // upgrade package
  useLatestPackageVersion(destDir, name)

  // mv gitignore .gitignore
  const gitignore = path.join(destDir, 'gitignore')
  copyFileSync(gitignore, path.join(destDir, '.gitignore'))
  unlinkSync(gitignore)
  // cp .env.local .env
  copyFileSync(path.join(destDir, '.env.local'), path.join(destDir, '.env'))

  // git init
  let logs = execSync('git init', { cwd: destDir })
  console.log(logs.toString())

  // npm install
  console.log('Installing packages in', destDir)
  logs = execSync('npm i', { cwd: destDir })
  console.log(logs.toString())
}

function useLatestPackageVersion(destDir: string, name?: string) {
  const packageJson = JSON.parse(
    readFileSync(path.join(__dirname, '../../package.json')).toString(),
  )
  const fname = path.join(destDir, 'package.json')
  const tplPackageJson = JSON.parse(readFileSync(fname).toString())

  if (name) {
    tplPackageJson.name = name
  }

  tplPackageJson.dependencies['@mbc-cqrs-serverless/core'] =
    packageJson.devDependencies['@mbc-cqrs-serverless/core']
  tplPackageJson.devDependencies['@mbc-cqrs-serverless/cli'] =
    packageJson.version

  writeFileSync(fname, JSON.stringify(tplPackageJson, null, 2))
}

export let exportsForTesting = {
  useLatestPackageVersion,
}
if (process.env.NODE_ENV !== 'test') {
  exportsForTesting = undefined
}
