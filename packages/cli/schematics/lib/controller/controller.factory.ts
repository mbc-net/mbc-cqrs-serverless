import { normalize, strings } from '@angular-devkit/core'
import {
  apply,
  chain,
  mergeWith,
  move,
  Rule,
  SchematicContext,
  template,
  Tree,
  url,
} from '@angular-devkit/schematics'

import { ControllerOptions } from './controller.schema'

function createController(options: ControllerOptions): Rule {
  return mergeWith(
    apply(url('./files'), [
      template({
        classify: strings.classify,
        dasherize: strings.dasherize,
        name: options.name,
      }),
      move(normalize(`/src/${strings.dasherize(options.name)}`)),
    ]),
  )
}

function createUnitTest(options: ControllerOptions): Rule {
  return mergeWith(
    apply(url('./units'), [
      template({
        classify: strings.classify,
        dasherize: strings.dasherize,
        name: options.name,
        specFileSuffix: 'spec',
      }),
      move(normalize(`/test/unit/${strings.dasherize(options.name)}`)),
    ]),
  )
}

export function main(options: ControllerOptions): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const filePath = normalize(
      `/src/${strings.dasherize(options.name)}/${strings.dasherize(options.name)}.controller.ts`,
    )
    const unitPath = normalize(
      `/test/unit/${strings.dasherize(options.name)}/${strings.dasherize(options.name)}.controller.spec.ts`,
    )
    const isFileExists = tree.exists(filePath)
    const isUnitExists = tree.exists(unitPath)

    if (isFileExists || isUnitExists) {
      if (isFileExists)
        _context.logger.info(`Controller file already exists at: ${filePath}`)
      if (isUnitExists)
        _context.logger.info(`Unit test file already exists at: ${unitPath}`)
      return
    }

    return chain([createController(options), createUnitTest(options)])
  }
}
