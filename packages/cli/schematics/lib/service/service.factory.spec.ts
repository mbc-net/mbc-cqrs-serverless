import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing'
import * as path from 'path'
import { ServiceOptions } from './service.schema'

describe('Service Factory', () => {
  const runner: SchematicTestRunner = new SchematicTestRunner(
    '.',
    path.join(__dirname, '../../collection.json'),
  )
  it('should generate correct template', async () => {
    const options: ServiceOptions = {
      name: 'foo',
    }
    const tree: UnitTestTree = await runner.runSchematic('service', options)

    const files: string[] = tree.files

    expect(
      files.find((filename) => filename === '/src/foo/foo.service.ts'),
    ).toBeDefined()
    expect(
      files.find(
        (filename) => filename === '/test/unit/foo/foo.service.spec.ts',
      ),
    ).toBeDefined()
    expect(tree.readContent('/src/foo/foo.service.ts')).toEqual(
      "import { CommandService, DataService } from '@mbc-cqrs-serverless/core'\n" +
        "import { Injectable, Logger } from '@nestjs/common'\n" +
        '\n' +
        '@Injectable()\n' +
        'export class FooService {\n' +
        '  private readonly logger = new Logger(FooService.name)\n' +
        '\n' +
        '  constructor(\n' +
        '    private readonly commandService: CommandService,\n' +
        '    private readonly dataService: DataService,\n' +
        '  ) {}\n' +
        '}\n',
    )
    console.log(tree.readContent('/test/unit/foo/foo.service.spec.ts'))

    expect(tree.readContent('/test/unit/foo/foo.service.spec.ts')).toEqual(
      "import { createMock } from '@golevelup/ts-jest'\n" +
        "import { Test, TestingModule } from '@nestjs/testing'\n" +
        "import { FooService } from 'src/foo/foo.service'\n" +
        '\n' +
        "describe('FooService', () => {\n" +
        '  let service: FooService\n' +
        '\n' +
        '  beforeEach(async () => {\n' +
        '    const module: TestingModule = await Test.createTestingModule({\n' +
        '      controllers: [FooService],\n' +
        '    }).useMocker(createMock).compile()\n' +
        '\n' +
        '    service = module.get<FooService>(FooService)\n' +
        '  })\n' +
        '\n' +
        "  it('should be defined', () => {\n" +
        '    expect(service).toBeDefined()\n' +
        '  })\n' +
        '})\n',
    )
  })
})
