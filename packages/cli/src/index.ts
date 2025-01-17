#!/usr/bin/env node
import { Command } from 'commander'

import loadCommands from './commands'
import { loadLocalBinCommandLoader, localBinExists } from './utils'

async function bootstrap() {
  const program = new Command()

  program
    .version(
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('../package.json').version,
      '-v, --version',
      'Output the current version.',
    )
    .usage('<command> [options]')
    .helpOption('-h, --help', 'Output usage information.')

  if (localBinExists()) {
    const localCommandLoader = loadLocalBinCommandLoader()
    localCommandLoader.default(program)
  } else {
    loadCommands(program)
  }

  await program.parseAsync(process.argv)

  if (!process.argv.slice(2).length) {
    program.outputHelp()
  }
}

bootstrap()
