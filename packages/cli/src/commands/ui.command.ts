import { Command } from 'commander'

import uiAction from '../actions/ui.action'

export function uiCommand(program: Command) {
  program
    .command('ui-common')
    .alias('ui')
    .description('Add mbc-cqrs-ui-common components to your project.')
    .requiredOption('-p, --pathDir <string>', 'The place of common-ui')
    .option('-b, --branch <string>', 'The branch name', 'main')
    .option('--auth <string>', 'The auth method (HTTPS - Token, SSH)', 'SSH')
    .option('--token <string>', 'The token with format: tokenId:tokenPassword')
    .option(
      '-c, --component <string>',
      'Component to install (all, appsync, component)',
      'all',
    )
    .option('--alias', 'The alias to common-ui')
    .action(uiAction)
}
