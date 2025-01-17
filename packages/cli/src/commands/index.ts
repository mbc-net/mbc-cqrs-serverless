/* eslint-disable no-console */
import { Command } from 'commander'

import { generateCommand } from './generate.command'
import { newCommand } from './new.command'
import { startCommand } from './start.command'
import { uiCommand } from './ui.command'

export default function loadCommands(program: Command) {
  newCommand(program)
  startCommand(program)
  uiCommand(program)
  generateCommand(program)

  // error handling
  program.on('command:*', () => {
    console.error(`\nInvalid command: '${program.args.join(' ')}'`)
    console.log(`See '--help' for a list of available commands.\n`)

    program.outputHelp()
  })
}
