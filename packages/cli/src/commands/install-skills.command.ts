import { Command } from 'commander'

import installSkillsAction from '../actions/install-skills.action'

export function installSkillsCommand(program: Command) {
  program
    .command('install-skills')
    .alias('skills')
    .description(
      'Install Claude Code skills for MBC CQRS Serverless development',
    )
    .option(
      '-p, --project',
      'Install to project directory (.claude/skills/) instead of personal (~/.claude/skills/)',
      false,
    )
    .option('-f, --force', 'Overwrite existing skills', false)
    .option('-l, --list', 'List available skills without installing', false)
    .option(
      '-c, --check',
      'Check if updates are available without installing',
      false,
    )
    .action(installSkillsAction)
}
