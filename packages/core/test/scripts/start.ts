/* eslint-disable */
import { spawn } from 'child_process'
import * as path from 'path'

const cwd = path.resolve(__dirname, '.')

const runCommand = function (cmd: string, args: string[]) {
  console.log(`Running command: ${cmd} ${args.join(' ')}`)

  const process = spawn(cmd, args, {
    cwd,
    detached: true, // Allow the process to run independently
    stdio: 'ignore', // Ignore stdio (no output to the console)
  })

  process.unref() // Allow the parent process to exit independently

  setTimeout(() => {
    console.log(`Started process with PID: ${process.pid}`)
  }, 40000)
}

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay))

module.exports = async function async() {
  try {
    runCommand('bash', ['start.sh']) // Adjust command and args if needed
    await sleep(45000)
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
}
