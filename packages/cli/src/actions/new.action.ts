import chalk from 'chalk'
import { execSync } from 'child_process'
import { Command } from 'commander'
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'fs'
import path from 'path'

import { logger } from '../ui'

/* eslint-disable no-console */
export default async function newAction(
  name: string = '',
  options: object,
  command: Command,
) {
  const [projectName, version = 'latest'] = name.split('@')

  logger.info(
    `Executing command '${command.name()}' for application '${projectName}' with options '${JSON.stringify(
      options,
    )}'`,
  )

  let packageVersion

  if (version === 'latest') {
    packageVersion = `^${
      getPackageVersion('@mbc-cqrs-serverless/core', true)[0]
    }` //  use the latest patch and minor versions
  } else {
    const versions = getPackageVersion('@mbc-cqrs-serverless/core')
    const regex = new RegExp(`^${version}(?![0-9]).*$`) // start with version and not directly follow by a digit
    const matchVersions = versions.filter((v) => regex.test(v))
    if (versions.includes(version)) {
      packageVersion = version // specific version
    } else if (matchVersions.length !== 0) {
      packageVersion = `^${matchVersions.at(-1)}` // use the patch and minor versions
    } else {
      logger.error(
        `The specified package version does not exist. Please choose a valid version! ${versions}`,
      )
      return
    }
  }
  const destDir = path.join(process.cwd(), projectName)
  logger.title(
    'MBC',
    `Generating MBC cqrs serverless application in ${chalk.green(destDir)}`,
  )

  mkdirSync(destDir, { recursive: true })
  useTemplate(destDir)

  usePackageVersion(destDir, packageVersion, projectName)

  // mv gitignore .gitignore
  const gitignore = path.join(destDir, 'gitignore')
  copyFileSync(gitignore, path.join(destDir, '.gitignore'))
  unlinkSync(gitignore)
  // mv infra/gitignore infra/.gitignore
  const infraGitignore = path.join(destDir, 'infra/gitignore')
  copyFileSync(infraGitignore, path.join(destDir, 'infra/.gitignore'))
  unlinkSync(infraGitignore)
  // replace project_name in .env.local
  updateEnvLocal(
    path.join(destDir, '.env.local'),
    '%%projectName%%',
    projectName,
  )
  // cp .env.local .env
  copyFileSync(path.join(destDir, '.env.local'), path.join(destDir, '.env'))

  // git init
  logger.title('git', 'Initializing git repository.')

  let logs = execSync('git init', { cwd: destDir })

  logger.success('Initialized a git repository.')

  // npm install
  logger.title('deps', `Installing dependencies`)
  logs = execSync('npm i --ignore-scripts', { cwd: destDir })
  execSync('npx prisma generate', { cwd: destDir })
  console.log(logs.toString())
  logger.success(`Dependencies installed`)

  logger.title('MBC', `Your application was created!`)
}

function useTemplate(destDir: string) {
  if (isLatestCli()) {
    cpSync(path.join(__dirname, '../../templates'), destDir, {
      recursive: true,
    })
  } else {
    execSync('npm i @mbc-cqrs-serverless/cli', { cwd: destDir })
    cpSync(
      path.join(destDir, 'node_modules/@mbc-cqrs-serverless/cli/templates'),
      destDir,
      { recursive: true },
    )
    rmSync(path.join(destDir, 'node_modules'), {
      recursive: true,
    })
  }
}

function isLatestCli() {
  const latestVersion = getPackageVersion('@mbc-cqrs-serverless/cli', true)[0]
  const packageJson = JSON.parse(
    readFileSync(path.join(__dirname, '../../package.json')).toString(),
  )
  const curVersion = packageJson.version
  return latestVersion === curVersion
}

function usePackageVersion(
  destDir: string,
  packageVersion: string,
  projectName?: string,
) {
  const packageJson = JSON.parse(
    readFileSync(path.join(__dirname, '../../package.json')).toString(),
  )
  const fname = path.join(destDir, 'package.json')
  const tplPackageJson = JSON.parse(readFileSync(fname).toString())

  if (projectName) {
    tplPackageJson.name = projectName
  }

  tplPackageJson.dependencies['@mbc-cqrs-serverless/core'] = packageVersion
  tplPackageJson.devDependencies['@mbc-cqrs-serverless/cli'] =
    packageJson.version

  writeFileSync(fname, JSON.stringify(tplPackageJson, null, 2))
}

function getPackageVersion(packageName: string, isLatest = false): string[] {
  if (isLatest) {
    const latestVersion = execSync(`npm view ${packageName} dist-tags.latest`)
      .toString()
      .trim()
    return [latestVersion]
  }

  const versions = JSON.parse(
    execSync(`npm view ${packageName} versions --json`).toString(),
  ) as string[]
  return versions
}

function updateEnvLocal(
  envPath: string,
  searchValue: string,
  replaceValue: string,
): void {
  const envLocalContent = readFileSync(envPath, 'utf8')
  const newEnvLocalContent = envLocalContent.replaceAll(
    searchValue,
    replaceValue,
  )
  writeFileSync(envPath, newEnvLocalContent)
}

export let exportsForTesting = {
  usePackageVersion,
  getPackageVersion,
  isLatestCli,
  updateEnvLocal,
}
if (process.env.NODE_ENV !== 'test') {
  exportsForTesting = undefined
}
