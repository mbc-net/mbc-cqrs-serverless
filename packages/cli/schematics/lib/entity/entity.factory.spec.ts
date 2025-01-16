import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing'
import * as path from 'path'
import { EntityOptions } from './entity.schema'

describe('Service Factory', () => {
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
      files.find((filename) => filename === '/src/foo/foo.controller.ts'),
    ).toBeDefined()
    expect(
      files.find(
        (filename) => filename === '/test/unit/foo/foo.controller.spec.ts',
      ),
    ).toBeDefined()
    expect(tree.readContent('/src/foo/foo.controller.ts')).toEqual(
      "import { Controller, Logger } from '@nestjs/common';\n" +
        "import { ApiTags } from '@nestjs/swagger'\n" +
        '\n' +
        "@ApiTags('foo')\n" +
        "@Controller('api/foo')\n" +
        'export class FooController {\n' +
        '    private readonly logger = new Logger(FooController.name)\n' +
        '\n' +
        '    constructor() {}\n' +
        '\n' +
        '}\n',
    )
    expect(tree.readContent('/test/unit/foo/foo.controller.spec.ts')).toEqual(
      "import { createMock } from '@golevelup/ts-jest'\n" +
        "import { Test, TestingModule } from '@nestjs/testing'\n" +
        "import { FooController } from 'src/foo/foo.controller'\n" +
        '\n' +
        "describe('FooController', () => {\n" +
        '  let controller: FooController\n' +
        '\n' +
        '  beforeEach(async () => {\n' +
        '    const module: TestingModule = await Test.createTestingModule({\n' +
        '      controllers: [FooController],\n' +
        '    }).useMocker(createMock).compile()\n' +
        '\n' +
        '    controller = module.get<FooController>(FooController)\n' +
        '  })\n' +
        '\n' +
        "  it('should be defined', () => {\n" +
        '    expect(controller).toBeDefined()\n' +
        '  })\n' +
        '})\n',
    )
  })
})
