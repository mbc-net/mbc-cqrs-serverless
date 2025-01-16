import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing'
import * as path from 'path'
import { EntityOptions } from './entity.schema'

describe('Entity Factory', () => {
  const runner: SchematicTestRunner = new SchematicTestRunner(
    '.',
    path.join(__dirname, '../../collection.json'),
  )
  it('should generate correct template', async () => {
    const options: EntityOptions = {
      name: 'foo',
    }
    const tree: UnitTestTree = await runner.runSchematic('entity', options)

    const files: string[] = tree.files

    expect(
      files.find(
        (filename) => filename === '/src/foo/entity/foo-command.entity.ts',
      ),
    ).toBeDefined()
    expect(
      files.find(
        (filename) => filename === '/src/foo/entity/foo-data-list.entity.ts',
      ),
    ).toBeDefined()
    expect(
      files.find(
        (filename) => filename === '/src/foo/entity/foo-data.entity.ts',
      ),
    ).toBeDefined()
    expect(tree.readContent('/src/foo/entity/foo-command.entity.ts')).toEqual(
      "import { CommandEntity } from '@mbc-cqrs-serverless/core'\n" +
        '\n' +
        "import { FooAttributes } from '../dto/foo-attributes.dto'\n" +
        '\n' +
        'export class FooCommandEntity extends CommandEntity {\n' +
        '  attributes: FooAttributes\n' +
        '\n' +
        '  constructor(partial: Partial<FooCommandEntity>) {\n' +
        '    super()\n' +
        '    Object.assign(this, partial)\n' +
        '  }\n' +
        '}\n',
    )
    expect(tree.readContent('/src/foo/entity/foo-data-list.entity.ts')).toEqual(
      "import { DataListEntity } from '@mbc-cqrs-serverless/core'\n" +
        '\n' +
        "import { FooDataEntity } from './foo-data.entity'\n" +
        '\n' +
        'export class FooDataListEntity extends DataListEntity {\n' +
        '  items: FooDataEntity[]\n' +
        '\n' +
        '  constructor(partial: Partial<FooDataListEntity>) {\n' +
        '    super(partial)\n' +
        '    Object.assign(this, partial)\n' +
        '  }\n' +
        '}\n',
    )
    expect(tree.readContent('/src/foo/entity/foo-data.entity.ts')).toEqual(
      "import { DataEntity } from '@mbc-cqrs-serverless/core'\n" +
        '\n' +
        "import { FooAttributes } from '../dto/foo-attributes.dto'\n" +
        '\n' +
        'export class FooDataEntity extends DataEntity {\n' +
        '  attributes: FooAttributes\n' +
        '\n' +
        '  constructor(partial: Partial<FooDataEntity>) {\n' +
        '    super(partial)\n' +
        '    Object.assign(this, partial)\n' +
        '  }\n' +
        '}\n',
    )
  })
})
