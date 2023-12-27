#!/usr/bin/env node
import { Command } from 'commander'

import loadCommands from './commands'

async function bootstrap() {
  const program = new Command()

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  program.version(require('../package.json').version)

  loadCommands(program)

  await program.parseAsync(process.argv)

  if (!process.argv.slice(2).length) {
    program.outputHelp()
  }
}

bootstrap()
