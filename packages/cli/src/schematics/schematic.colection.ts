import chalk from 'chalk'
import Table from 'cli-table3'

export interface Schematic {
  name: string
  alias: string
  description: string
}

export const schematics: Schematic[] = [
  {
    name: 'module',
    alias: 'mo',
    description: 'Create a module.',
  },
  {
    name: 'controller',
    alias: 'co',
    description: 'Create a controller.',
  },
  {
    name: 'service',
    alias: 'se',
    description: 'Create a service.',
  },
  {
    name: 'entity',
    alias: 'en',
    description: 'Create a entity.',
  },
  {
    name: 'dto',
    alias: 'dto',
    description: 'Create a dto.',
  },
]

export function buildSchematicsListAsTable(): string {
  const leftMargin = '    '
  const tableConfig = {
    head: ['name', 'alias', 'description'],
    chars: {
      left: leftMargin.concat('│'),
      'top-left': leftMargin.concat('┌'),
      'bottom-left': leftMargin.concat('└'),
      mid: '',
      'left-mid': '',
      'mid-mid': '',
      'right-mid': '',
    },
  }
  const table: any = new Table(tableConfig)
  for (const schematic of schematics) {
    table.push([
      chalk.green(schematic.name),
      chalk.cyan(schematic.alias),
      schematic.description,
    ])
  }
  return table.toString()
}
