import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing'
import * as path from 'path'
import { DtoOptions } from './dto.schema'

describe('Dto Factory', () => {
  const runner: SchematicTestRunner = new SchematicTestRunner(
    '.',
    path.join(__dirname, '../../collection.json'),
  )
  it('should generate correct template', async () => {
    const options: DtoOptions = {
      name: 'foo',
    }
    const tree: UnitTestTree = await runner.runSchematic('dto', options)

    const files: string[] = tree.files

    expect(
      files.find(
        (filename) => filename === '/src/foo/dto/foo-attributes.dto.ts',
      ),
    ).toBeDefined()
    expect(
      files.find((filename) => filename === '/src/foo/dto/foo-command.dto.ts'),
    ).toBeDefined()
    expect(
      files.find((filename) => filename === '/src/foo/dto/foo-create.dto.ts'),
    ).toBeDefined()
    expect(
      files.find((filename) => filename === '/src/foo/dto/foo-search.dto.ts'),
    ).toBeDefined()
    expect(
      files.find((filename) => filename === '/src/foo/dto/foo-update.dto.ts'),
    ).toBeDefined()
    expect(tree.readContent('/src/foo/dto/foo-attributes.dto.ts')).toEqual(
      "import { IsObject } from 'class-validator'\n" +
        '\n' +
        'export class FooAttributes {\n' +
        '  @IsObject()\n' +
        '  value: object\n' +
        '}\n',
    )
    expect(tree.readContent('/src/foo/dto/foo-command.dto.ts')).toEqual(
      "import { CommandDto } from '@mbc-cqrs-serverless/core'\n" +
        "import { Type } from 'class-transformer'\n" +
        "import { ValidateNested } from 'class-validator'\n" +
        '\n' +
        "import { FooAttributes } from './foo-attributes.dto'\n" +
        '\n' +
        'export class FooCommandDto extends CommandDto {\n' +
        '  @Type(() => FooAttributes)\n' +
        '  @ValidateNested()\n' +
        '  attributes: FooAttributes\n' +
        '\n' +
        '  constructor(partial: Partial<FooCommandDto>) {\n' +
        '    super()\n' +
        '    Object.assign(this, partial)\n' +
        '  }\n' +
        '}\n',
    )
    expect(tree.readContent('/src/foo/dto/foo-create.dto.ts')).toEqual(
      "import { Type } from 'class-transformer'\n" +
        "import { IsOptional, IsString, ValidateNested } from 'class-validator'\n" +
        '\n' +
        "import { FooAttributes } from './foo-attributes.dto'\n" +
        '\n' +
        'export class FooCreateDto {\n' +
        '  @IsString()\n' +
        '  name: string\n' +
        '\n' +
        '  @Type(() => FooAttributes)\n' +
        '  @ValidateNested()\n' +
        '  @IsOptional()\n' +
        '  attributes?: FooAttributes\n' +
        '\n' +
        '  constructor(partial: Partial<FooCreateDto>) {\n' +
        '    Object.assign(this, partial)\n' +
        '  }\n' +
        '}\n',
    )
    expect(tree.readContent('/src/foo/dto/foo-search.dto.ts')).toEqual(
      "import { SearchDto } from '@mbc-cqrs-serverless/core'\n" +
        'export class FooSearchDto extends SearchDto {}\n',
    )
    expect(tree.readContent('/src/foo/dto/foo-update.dto.ts')).toEqual(
      "import { PartialType } from '@nestjs/swagger'\n" +
        "import { Transform, Type } from 'class-transformer'\n" +
        'import {\n' +
        '  IsBoolean,\n' +
        '  IsOptional,\n' +
        '  IsString,\n' +
        '  ValidateNested,\n' +
        "} from 'class-validator'\n" +
        '\n' +
        "import { FooAttributes } from './foo-attributes.dto'\n" +
        '\n' +
        'export class FooUpdateAttributes extends PartialType(FooAttributes) {}\n' +
        '\n' +
        'export class FooUpdateDto {\n' +
        '  @IsString()\n' +
        '  @IsOptional()\n' +
        '  name?: string\n' +
        '\n' +
        '  @IsBoolean()\n' +
        '  @Transform(({ value }) =>\n' +
        "    value === 'true' ? true : value === 'false' ? false : value,\n" +
        '  )\n' +
        '  @IsOptional()\n' +
        '  isDeleted?: boolean\n' +
        '\n' +
        '  @Type(() => FooUpdateAttributes)\n' +
        '  @ValidateNested()\n' +
        '  @IsOptional()\n' +
        '  attributes?: FooUpdateAttributes\n' +
        '\n' +
        '  constructor(partial: Partial<FooUpdateDto>) {\n' +
        '    Object.assign(this, partial)\n' +
        '  }\n' +
        '}\n',
    )
  })
})
