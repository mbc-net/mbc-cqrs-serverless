import { Command } from 'commander'

import startAction from '../actions/start.action'

export function startCommand(program: Command) {
  program
    .command('start')
    .alias('s')
    .description('Start application with serverless framework')
    .action(startAction)
}
