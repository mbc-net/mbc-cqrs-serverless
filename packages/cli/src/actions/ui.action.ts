import { execSync } from 'child_process'
import { Command } from 'commander'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { rimrafSync } from 'rimraf'

const repoUrl = 'https://gitlab.com/mbc-net/common/mbc-cqrs-ui-common.git'

const componentOptions = ['all', 'appsync', 'component']

/* eslint-disable no-console */
export default async function uiAction(options: object, command: Command) {
  console.log(
    `Executing command '${command.name()}' for application with options '${JSON.stringify(
      options,
    )}'`,
  )

  const { branch, auth, component, pathDir, token = '' } = options as any

  if (
    componentOptions.findIndex((optionName) => optionName === component) === -1
  ) {
    console.error(
      `Please choose correct component options: ${componentOptions.join(', ')}`,
    )
  }

  // Check command run in base src
  if (!existsSync(path.join(process.cwd(), 'tsconfig.json'))) {
    console.log('Please run command in base folder')
    return
  }

  // Check tsconfig.json contain path @ms
  const tsconfig = JSON.parse(
    readFileSync(path.join(process.cwd(), 'tsconfig.json'), 'utf8'),
  )

  if (
    tsconfig?.compilerOptions &&
    tsconfig?.compilerOptions?.paths &&
    tsconfig?.compilerOptions?.paths.hasOwnProperty('@ms/*')
  ) {
    console.log('The project already contain mbc-cqrs-ui-common')
    return
  }

  // Copy source
  installTemplate({
    auth,
    token,
    pathDir,
    branch,
    component,
  })

  // Modify tsconfig path alias
  if (!tsconfig?.compilerOptions) {
    tsconfig.compilerOptions = {}
  }

  if (!tsconfig?.compilerOptions?.paths) {
    tsconfig.compilerOptions.paths = {}
  }

  tsconfig.compilerOptions.paths['@ms/*'] = [`./${pathDir}/*`]

  writeFileSync(
    path.join(process.cwd(), 'tsconfig.json'),
    JSON.stringify(tsconfig, null, 2),
    {
      encoding: 'utf8',
    },
  )

  // Modify package.json
  modifyDependencies({ pathDir, component })

  // npm install
  console.log('Installing packages')
  const logs = execSync('npm i')
  console.log(logs.toString())
}

const installTemplate = ({
  auth,
  token,
  pathDir,
  branch,
  component,
}: {
  auth: string
  token: string
  pathDir: string
  branch: string
  component: string
}) => {
  let gitUrl = repoUrl

  if (auth === 'SSH') {
    gitUrl = 'git@gitlab.com:mbc-net/common/mbc-cqrs-ui-common.git'
  } else if (auth === 'HTTPS - Token') {
    gitUrl = repoUrl.replace(/^https:\/\//, `https://${token}@`)
  }

  // Copy source
  const destDir = path.join(process.cwd(), pathDir)
  console.log('Adding MBC common ui in', destDir)
  mkdirSync(destDir, { recursive: true })
  const logs = execSync(`git clone --branch ${branch} ${gitUrl} ${destDir}`)
  console.log(logs.toString())

  // remove .git
  rimrafSync(`${destDir}/.git`)

  if (component === 'component') {
    rimrafSync(`${destDir}/appsync`)
  } else if (component === 'appsync') {
    ;['components', 'lib', 'modules', 'styles', 'types'].forEach((name) =>
      rimrafSync(`${destDir}/${name}`),
    )
  }
}

const modifyDependencies = ({
  pathDir,
  component,
}: {
  pathDir: string
  component: string
}) => {
  const destDir = path.join(process.cwd(), pathDir)
  const srcPackage = JSON.parse(readFileSync(`${destDir}/package.json`, 'utf8'))

  const destPackage = JSON.parse(
    readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'),
  )

  const modifiedPackage = getModifyPackage({
    srcPackage,
    destPackage,
    component,
  })

  writeFileSync(
    path.join(process.cwd(), 'package.json'),
    JSON.stringify(modifiedPackage, null, 2),
    {
      encoding: 'utf8',
    },
  )

  rimrafSync(`${destDir}/package.json`)
}

const getModifyPackage = ({
  srcPackage,
  destPackage,
  component,
}: {
  srcPackage: any
  destPackage: any
  component: string
}) => {
  // modify dependencies
  if (srcPackage?.dependencies) {
    if (!destPackage.dependencies) {
      destPackage.dependencies = {}
    }
    for (const key of Object.keys(srcPackage.dependencies)) {
      if (!destPackage.dependencies[key]) {
        if (component === 'component' && key === 'aws-amplify') continue
        if (component === 'appsync' && key !== 'aws-amplify') continue
        destPackage.dependencies[key] = srcPackage.dependencies[key]
      }
    }
  }
  return destPackage
}
