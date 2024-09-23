/* eslint-disable */
import { spawn } from 'child_process'
import { readFileSync } from 'fs'

import * as path from 'path'

const cwd = path.resolve(__dirname, '.')
const filePath = path.join(__dirname, 'docker.out.txt')

function readLastLines(filePath, numLines) {
  try {
    const data = readFileSync(filePath, 'utf8')
    const lines = data.trim().split('\n')
    return lines.slice(-numLines)
  } catch (err) {
    console.error(`Error reading file: ${err}`)
    return []
  }
}

function checkLogs() {
  const lastLines = readLastLines(filePath, 3)
  console.log('lastLines', lastLines)
  const allEndWithStarted = lastLines.every((line) => line.endsWith('Started'))
  return allEndWithStarted
}

const runCommand = function (cmd: string, args: string[]) {
  console.log(`Running command: ${cmd} ${args.join(' ')}`)

  const process = spawn(cmd, args, {
    cwd,
    detached: true, // Allow the process to run independently
    stdio: 'ignore', // Ignore stdio (no output to the console)
  })

  process.unref() // Allow the parent process to exit independently
}

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay))

module.exports = async function async() {
  try {
    runCommand('bash', ['start.sh']) // Adjust command and args if needed

    let result = false

    while (!result) {
      await sleep(3000)
      result = checkLogs()
    }
    await sleep(15000)
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
}
