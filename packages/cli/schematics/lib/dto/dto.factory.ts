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
import { DtoOptions } from './dto.schema'

function createEntity(options: DtoOptions): Rule {
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

export function main(options: DtoOptions): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const basePath = `/src/${strings.dasherize(options.name)}/dto`
    const filePaths = [
      `${basePath}/${strings.dasherize(options.name)}-attributes.dto.ts`,
      `${basePath}/${strings.dasherize(options.name)}-command.dto.ts`,
      `${basePath}/${strings.dasherize(options.name)}-create.dto.ts`,
      `${basePath}/${strings.dasherize(options.name)}-search.dto.ts`,
      `${basePath}/${strings.dasherize(options.name)}-update.dto.ts`,
    ]

    if (checkFilesExist(tree, filePaths)) {
      _context.logger.info('One or more files already exist.')
      return
    }

    return chain([createEntity(options)])
  }
}
