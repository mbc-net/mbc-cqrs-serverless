import { execSync } from 'child_process'
import { existsSync } from 'fs'
import * as path from 'path'
import { Env } from '../config'

let isBuild = false

export function buildApp(env: Env, isLocal = false) {
  const cwd = path.resolve(__dirname, '../..')
  console.log('build app started with cwd:', env, cwd)

  const layerPath = 'dist_layer'
  const appPath = 'dist'
  const layerFullPath = path.resolve(cwd, layerPath)
  const appFullPath = path.resolve(cwd, appPath)

  if (isLocal || (existsSync(layerFullPath) && existsSync(appFullPath))) {
    console.log('return from cached build folder')
    return {
      layerPath: layerFullPath,
      appPath: appFullPath,
    }
  }

  const runCommand = function (cmd: string) {
    console.log(cmd)
    const ret = execSync(cmd, { cwd })
    console.log(ret.toString())
  }

  // clean up
  console.log('============= clean up =============')
  runCommand(`rm -rf ${layerPath}`)
  runCommand(`rm -rf ${appPath}`)
  runCommand(`rm -rf node_modules`)

  // install packages
  console.log('============= install packages =============')
  runCommand('npm ci')

  // build nestjs application
  console.log('============= build nestjs application =============')
  runCommand('npm run build:prod')

  // remove unnecessary packages
  console.log('============= remove unnecessary packages =============')
  runCommand('npm ci --omit=dev --omit=optional')
  const prunePath = `${layerPath}/prune`
  runCommand(`mkdir -p ${prunePath}`)
  runCommand(`npm --prefix ./${prunePath} i node-prune modclean`)
  runCommand(`npm --prefix ./${prunePath} exec node-prune`)
  runCommand(
    `npm --prefix ./${prunePath} exec modclean -- -n default:safe,default:caution -r`,
  )
  runCommand(`rm -rf ${prunePath}`)
  runCommand(
    'mv node_modules/.prisma/client/libquery_engine-linux-arm64-* prisma',
  )
  runCommand('rm -rf node_modules/.prisma/client/libquery_engine-*')
  runCommand(
    'mv prisma/libquery_engine-linux-arm64-* node_modules/.prisma/client',
  )
  runCommand('rm -rf node_modules/prisma/libquery_engine-*')
  runCommand('rm -rf node_modules/@prisma/engines/**')

  // copy to layer
  console.log('============= copy to layer =============')
  const nodejsLayerPath = `${layerPath}/nodejs`
  runCommand(`mkdir -p ${nodejsLayerPath}`)
  runCommand(`mv node_modules ${nodejsLayerPath}`)

  console.log('============= build app finished =============')

  if (isLocal) {
    console.log('============= install local packages =============')
    runCommand('npm install')
  }

  isBuild = true

  return {
    layerPath: layerFullPath,
    appPath: appFullPath,
  }
}
