import { Command } from 'commander'

import newAction from '../actions/new.action'

export function newCommand(program: Command) {
  program
    .command('new [name]')
    .alias('n')
    .description(
      'Generate a new CQRS application using the MBC CQRS serverless framework',
    )
    .action(newAction)
}
