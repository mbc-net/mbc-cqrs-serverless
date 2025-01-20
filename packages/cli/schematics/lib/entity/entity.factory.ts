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

import { checkFilesExist } from '../../utils'
import { EntityOptions } from './entity.schema'

function createEntity(options: EntityOptions): Rule {
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

export function main(options: EntityOptions): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const basePath = `/src/${strings.dasherize(options.name)}/entity`
    const filePaths = [
      `${basePath}/${strings.dasherize(options.name)}-command.entity.ts`,
      `${basePath}/${strings.dasherize(options.name)}-data-list.entity.ts`,
      `${basePath}/${strings.dasherize(options.name)}-data.entity.ts`,
    ]

    if (checkFilesExist(tree, filePaths)) {
      _context.logger.info('One or more files already exist.')
      return
    }

    return chain([createEntity(options)])
  }
}
