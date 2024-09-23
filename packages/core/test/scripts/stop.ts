/* eslint-disable */
import { execSync } from 'child_process'
import * as path from 'path'

const cwd = path.resolve(__dirname, '.')

const runCommand = function (cmd: string) {
  console.log(cmd)
  const ret = execSync(cmd, { cwd })
  console.log(ret.toString())
}

module.exports = function () {
  try {
    runCommand('bash stop.sh')
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
}
