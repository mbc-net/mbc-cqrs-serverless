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

import { ServiceOptions } from './service.schema'

function createService(options: ServiceOptions): Rule {
  return mergeWith(
    apply(url('./files'), [
      template({
        ...strings,
        ...options,
      }),
      move(normalize(`/src/${strings.dasherize(options.name)}`)),
    ]),
  )
}

function createUnitTest(options: ServiceOptions): Rule {
  return mergeWith(
    apply(url('./units'), [
      template({
        ...strings,
        ...options,
        specFileSuffix: 'spec',
      }),
      move(normalize(`/test/unit/${strings.dasherize(options.name)}`)),
    ]),
  )
}

export function main(options: ServiceOptions): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const filePath = normalize(
      `/src/${strings.dasherize(options.name)}/${strings.dasherize(options.name)}.service.ts`,
    )
    const unitPath = normalize(
      `/test/unit/${strings.dasherize(options.name)}/${strings.dasherize(options.name)}.service.spec.ts`,
    )
    const isFileExists = tree.exists(filePath)
    const isUnitExists = tree.exists(unitPath)

    if (isFileExists || isUnitExists) {
      if (isFileExists)
        _context.logger.info(`Service file already exists at: ${filePath}`)
      if (isUnitExists)
        _context.logger.info(`Unit test file already exists at: ${unitPath}`)
      return
    }

    return chain([createService(options), createUnitTest(options)])
  }
}
