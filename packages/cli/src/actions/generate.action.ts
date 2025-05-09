import { Command } from 'commander'

import { Input } from '../commands/command.input'
import { SchematicRunner } from '../runners/schematic.runner'
import { SchematicOption } from '../schematics'
import { logger } from '../ui'

/* eslint-disable no-console */
export default async function generateAction(
  schematic: string,
  name: string,
  options: object,
  command: Command,
) {
  logger.info(
    `Executing command '${command.name()}' for application with options '${JSON.stringify(
      options,
    )}'`,
  )
  const commandOptions = command.opts()

  const formatOptions: Input[] = []
  formatOptions.push({ name: 'dry-run', value: !!commandOptions.dryRun })
  formatOptions.push({ name: 'mode', value: commandOptions.mode })
  formatOptions.push({
    name: 'schema',
    value: !!commandOptions.schema || !!commandOptions.noSchema, // noSchema > schema
  })

  const inputs: Input[] = []
  inputs.push({ name: 'schematic', value: schematic })
  inputs.push({ name: 'name', value: name })

  const fullInputs = formatOptions.concat(inputs)

  const schematicOptions: SchematicOption[] = mapSchematicOptions(fullInputs)

  const runner = new SchematicRunner()
  const fullCommand = buildCommandLine(schematic, schematicOptions)

  runner.run(fullCommand)
}

function buildCommandLine(name: string, options: any[]) {
  return `@mbc-cqrs-serverless/cli:${name}${buildOptions(options)}`
}

function buildOptions(options: SchematicOption[]): string {
  return options.reduce((line, option) => {
    return line.concat(` ${option.toCommandString()}`)
  }, '')
}

const mapSchematicOptions = (inputs: Input[]): SchematicOption[] => {
  const excludedInputNames = ['schematic', 'spec', 'flat', 'specFileSuffix']
  const options: SchematicOption[] = []
  inputs.forEach((input) => {
    if (!excludedInputNames.includes(input.name) && input.value !== undefined) {
      options.push(new SchematicOption(input.name, input.value))
    }
  })
  return options
}
