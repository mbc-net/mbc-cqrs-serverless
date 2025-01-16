import {
  SchematicTestRunner,
  UnitTestTree,
} from '@angular-devkit/schematics/testing'
import * as path from 'path'
import { ModuleOptions } from './module.schema'

describe('Entity Factory', () => {
  const runner: SchematicTestRunner = new SchematicTestRunner(
    '.',
    path.join(__dirname, '../../collection.json'),
  )
  it('should generate full async template', async () => {
    const options: ModuleOptions = {
      name: 'foo',
      mode: 'async',
      schema: true,
    }
    const tree: UnitTestTree = await runner.runSchematic('module', options)

    const files: string[] = tree.files

    // dto
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
    // entity
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

    // controller
    expect(
      files.find((filename) => filename === '/src/foo/foo.controller.ts'),
    ).toBeDefined()
    expect(
      files.find(
        (filename) => filename === '/test/unit/foo/foo.controller.spec.ts',
      ),
    ).toBeDefined()
    // service
    expect(
      files.find((filename) => filename === '/src/foo/foo.service.ts'),
    ).toBeDefined()
    expect(
      files.find(
        (filename) => filename === '/test/unit/foo/foo.service.spec.ts',
      ),
    ).toBeDefined()
    // handler
    expect(
      files.find(
        (filename) => filename === '/src/foo/handler/foo-rds.handler.ts',
      ),
    ).toBeDefined()
    // module
    expect(
      files.find((filename) => filename === '/src/foo/foo.module.ts'),
    ).toBeDefined()

    // Verify content of foo.service.ts
    const serviceContent = tree.readContent('/src/foo/foo.service.ts')

    // Check occurrences of specific strings
    const publishPartialUpdateAsyncMatches = (
      serviceContent.match(/publishPartialUpdateAsync/g) || []
    ).length
    const publishAsyncMatches = (serviceContent.match(/publishAsync/g) || [])
      .length

    expect(publishPartialUpdateAsyncMatches).toBe(2)
    expect(publishAsyncMatches).toBe(1)
  })

  it('should generate async template with no schema', async () => {
    const options: ModuleOptions = {
      name: 'foo',
      mode: 'async',
      schema: false,
    }
    const tree: UnitTestTree = await runner.runSchematic('module', options)

    const files: string[] = tree.files

    // dto
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
    // entity
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

    // controller
    expect(
      files.find((filename) => filename === '/src/foo/foo.controller.ts'),
    ).toBeDefined()
    expect(
      files.find(
        (filename) => filename === '/test/unit/foo/foo.controller.spec.ts',
      ),
    ).toBeDefined()
    // service
    expect(
      files.find((filename) => filename === '/src/foo/foo.service.ts'),
    ).toBeDefined()
    expect(
      files.find(
        (filename) => filename === '/test/unit/foo/foo.service.spec.ts',
      ),
    ).toBeDefined()
    // handler
    expect(
      files.find(
        (filename) => filename === '/src/foo/handler/foo-rds.handler.ts',
      ),
    ).not.toBeDefined()
    // module
    expect(
      files.find((filename) => filename === '/src/foo/foo.module.ts'),
    ).toBeDefined()

    // Verify content of foo.service.ts
    const serviceContent = tree.readContent('/src/foo/foo.service.ts')

    // Check occurrences of specific strings
    const publishPartialUpdateAsyncMatches = (
      serviceContent.match(/publishPartialUpdateAsync/g) || []
    ).length
    const publishAsyncMatches = (serviceContent.match(/publishAsync/g) || [])
      .length

    expect(publishPartialUpdateAsyncMatches).toBe(2)
    expect(publishAsyncMatches).toBe(1)
  })

  it('should generate full sync template', async () => {
    const options: ModuleOptions = {
      name: 'foo',
      mode: 'sync',
      schema: true,
    }
    const tree: UnitTestTree = await runner.runSchematic('module', options)

    const files: string[] = tree.files

    // dto
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
    // entity
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

    // controller
    expect(
      files.find((filename) => filename === '/src/foo/foo.controller.ts'),
    ).toBeDefined()
    expect(
      files.find(
        (filename) => filename === '/test/unit/foo/foo.controller.spec.ts',
      ),
    ).toBeDefined()
    // service
    expect(
      files.find((filename) => filename === '/src/foo/foo.service.ts'),
    ).toBeDefined()
    expect(
      files.find(
        (filename) => filename === '/test/unit/foo/foo.service.spec.ts',
      ),
    ).toBeDefined()
    // handler
    expect(
      files.find(
        (filename) => filename === '/src/foo/handler/foo-rds.handler.ts',
      ),
    ).toBeDefined()
    // module
    expect(
      files.find((filename) => filename === '/src/foo/foo.module.ts'),
    ).toBeDefined()

    // Verify content of foo.service.ts
    const serviceContent = tree.readContent('/src/foo/foo.service.ts')

    // Check occurrences of specific strings
    const publishPartialUpdateAsyncMatches = (
      serviceContent.match(/publishPartialUpdateSync/g) || []
    ).length
    const publishAsyncMatches = (serviceContent.match(/publishSync/g) || [])
      .length

    expect(publishPartialUpdateAsyncMatches).toBe(2)
    expect(publishAsyncMatches).toBe(1)
  })

  it('should generate full sync template with no schema', async () => {
    const options: ModuleOptions = {
      name: 'foo',
      mode: 'sync',
      schema: false,
    }
    const tree: UnitTestTree = await runner.runSchematic('module', options)

    const files: string[] = tree.files

    // dto
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
    // entity
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

    // controller
    expect(
      files.find((filename) => filename === '/src/foo/foo.controller.ts'),
    ).toBeDefined()
    expect(
      files.find(
        (filename) => filename === '/test/unit/foo/foo.controller.spec.ts',
      ),
    ).toBeDefined()
    // service
    expect(
      files.find((filename) => filename === '/src/foo/foo.service.ts'),
    ).toBeDefined()
    expect(
      files.find(
        (filename) => filename === '/test/unit/foo/foo.service.spec.ts',
      ),
    ).toBeDefined()
    // handler
    expect(
      files.find(
        (filename) => filename === '/src/foo/handler/foo-rds.handler.ts',
      ),
    ).not.toBeDefined()
    // module
    expect(
      files.find((filename) => filename === '/src/foo/foo.module.ts'),
    ).toBeDefined()

    // Verify content of foo.service.ts
    const serviceContent = tree.readContent('/src/foo/foo.service.ts')

    // Check occurrences of specific strings
    const publishPartialUpdateAsyncMatches = (
      serviceContent.match(/publishPartialUpdateSync/g) || []
    ).length
    const publishAsyncMatches = (serviceContent.match(/publishSync/g) || [])
      .length

    expect(publishPartialUpdateAsyncMatches).toBe(2)
    expect(publishAsyncMatches).toBe(1)
  })
})
