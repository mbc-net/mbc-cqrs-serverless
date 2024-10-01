/* eslint-disable */
import { spawn } from 'child_process'
import { readFileSync } from 'fs'

import * as path from 'path'

const cwd = path.resolve(__dirname, '.')
const filePath = path.join(__dirname, 'docker.out.txt')

const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms))

const retry = async <T>(
  fn: () => Promise<T> | T,
  { retries, retryIntervalMs }: { retries: number; retryIntervalMs: number },
): Promise<T> => {
  try {
    await sleep(retryIntervalMs)
    return await fn()
  } catch (error) {
    console.log(`Retry: ${retries}::: ${error}`)
    if (retries <= 0) {
      throw error
    }
    await sleep(retryIntervalMs)
    return retry(fn, { retries: retries - 1, retryIntervalMs })
  }
}

const readLastLines = (filePath, numLines) => {
  try {
    const data = readFileSync(filePath, 'utf8')
    const lines = data.trim().split('\n')
    return lines.slice(-numLines)
  } catch (err) {
    console.error(`Error reading file: ${err}`)
    return []
  }
}

const checkStartedInLastThreeLine = () => {
  const lastLines = readLastLines(filePath, 3)
  console.log('lastLines', lastLines)
  const allEndWithStarted = lastLines.every(
    (line) => line.endsWith('Started') || line.endsWith('Running'),
  )
  return allEndWithStarted
}

const dockerStarted = async () => {
  await retry(
    async () => {
      const result = checkStartedInLastThreeLine()
      if (result) return
      throw new Error('docker is not started!')
    },
    { retries: 120, retryIntervalMs: 5 * 1000 },
  )
}

const slsStarted = async () => {
  await retry(
    async () => {
      const fileContent = readFileSync(
        path.join(__dirname, 'sls.out.txt'),
        'utf-8',
      )
      const result = fileContent.includes('Server ready: http://0.0.0.0:3000')
      console.log('slsStarted', result)
      if (result) return
      throw new Error('sls is not started!')
    },
    { retries: 10, retryIntervalMs: 5 * 1000 },
  )
}

const slsStable = async () => {
  await retry(
    async () => {
      const fileContent = readFileSync(
        path.join(__dirname, 'sls_pid.out.txt'),
        'utf-8',
      )
      const result = fileContent.length > 0
      console.log('slsStable', result)
      if (result) return
      throw new Error('sls is not stable!')
    },
    { retries: 10, retryIntervalMs: 5 * 1000 },
  )
}

const runCommand = function (cmd: string, args: string[]) {
  console.log(`Running command: ${cmd} ${args.join(' ')}`)

  const process = spawn(cmd, args, {
    cwd,
    detached: true, // Allow the process to run independently
    stdio: 'ignore', // Ignore stdio (no output to the console)
  })

  process.unref() // Allow the parent process to exit independently

  console.log(`Started process with PID: ${process.pid}`)
}

module.exports = async function async() {
  try {
    runCommand('bash', ['start.sh']) // Adjust command and args if needed

    await dockerStarted()

    await slsStarted()

    // wait sls stable
    await slsStable()
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
}
