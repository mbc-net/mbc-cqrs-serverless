import { Command } from 'commander'

import generateAction from '../actions/generate.action'
import { buildSchematicsListAsTable } from '../schematics/schematic.colection'

export async function generateCommand(program: Command) {
  program
    .command('generate <schematic> [name]')
    .alias('g')
    .description(buildDescription())
    .option(
      '-d, --dry-run',
      'Report actions that would be taken without writing out results.',
    )
    .option(
      '--mode <mode>',
      'Specify the mode of operation: sync or async (default: async)',
      'async',
    )
    .option('--schema', 'Enable schema generation (default: false)', true)
    .option('--no-schema', 'Enable schema generation (default: false)', false)
    .action(generateAction)
}

function buildDescription(): string {
  return (
    'Generate a MBC-cqrs-serverless element.\n' +
    `  Schematics available on the collection:\n` +
    buildSchematicsListAsTable()
  )
}
