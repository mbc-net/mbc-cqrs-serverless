import { normalize, strings } from '@angular-devkit/core'
import {
  apply,
  chain,
  filter,
  mergeWith,
  move,
  noop,
  Rule,
  SchematicContext,
  template,
  Tree,
  url,
} from '@angular-devkit/schematics'
import * as ts from 'typescript'
import { parseDocument, stringify } from 'yaml'

import { ModuleOptions } from './module.schema'

export function main(options: ModuleOptions): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const filePath = normalize(
      `/src/${strings.dasherize(options.name)}/${strings.dasherize(options.name)}.module.ts`,
    )
    const isFileExists = tree.exists(filePath)

    if (isFileExists) {
      _context.logger.info(`Module file already exists at: ${filePath}`)
      return
    }

    updateMainModule(tree, options)

    updateCdkInfraStack(tree, options)

    updateCqrsTable(tree, options)

    updateServerlessYaml(tree, options)

    if (options.schema) {
      updatePrismaSchema(tree, options)
    }

    return chain([createModule(options), createUnitTest(options)])
  }
}

// create rule
function createModule(options: ModuleOptions): Rule {
  return mergeWith(
    apply(url(`./files/${options.mode}`), [
      options.schema ? noop() : filter((path) => !path.endsWith('.handler.ts')),
      template({
        ...strings,
        ...options,
      }),
      move(normalize(`/src/${strings.dasherize(options.name)}`)),
    ]),
  )
}

function createUnitTest(options: ModuleOptions): Rule {
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

// modify main.module.ts
function updateMainModule(tree: Tree, options: ModuleOptions) {
  const mainModulePath = 'src/main.module.ts'
  const isMainModulePathExists = tree.exists(mainModulePath)
  if (isMainModulePathExists) {
    const fileBuffer = tree.read(mainModulePath)
    const content = fileBuffer.toString('utf-8')
    const lines = content.split('\n')

    lines.splice(
      5,
      0,
      `import { ${strings.classify(options.name)}Module } from './${strings.dasherize(options.name)}/${strings.dasherize(options.name)}.module'`,
    )
    lines.splice(23, 0, `    ${strings.classify(options.name)}Module,`)
    const newContent = lines.join('\n')
    tree.overwrite(mainModulePath, newContent)
    return tree
  }
}

// modify infra cdk
function updateCdkInfraStack(tree: Tree, options: ModuleOptions) {
  const infraStackPath = 'infra/libs/infra-stack.ts'
  const isInfraStackExists = tree.exists(infraStackPath)
  if (isInfraStackExists) {
    const fileBuffer = tree.read(infraStackPath)
    const content = fileBuffer.toString('utf-8')
    const sourceFile = ts.createSourceFile(
      infraStackPath,
      content,
      ts.ScriptTarget.Latest,
      true,
    )
    const updatedContent = updateTableNamesArray(
      sourceFile,
      [`${strings.dasherize(options.name)}-command`],
      content,
    )
    tree.overwrite(infraStackPath, updatedContent)
    return tree
  }
}

function updateTableNamesArray(
  sourceFile: ts.SourceFile,
  newTableNames: string[],
  content: string,
): string {
  let updatedContent = content

  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText() === 'tableNames' &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      // Extract existing table names
      const existingElements = node.initializer.elements.map((element) =>
        element.getText().replace(/['"]/g, ''),
      )

      // Append new table names, ensuring no duplicates
      const updatedTableNames = Array.from(
        new Set([...existingElements, ...newTableNames]),
      )

      // Generate the updated array string
      const newArray = `[${updatedTableNames.map((name) => `'${name}'`).join(', ')}]`

      // Replace the existing array with the new array
      updatedContent =
        updatedContent.slice(0, node.initializer.getStart()) +
        newArray +
        updatedContent.slice(node.initializer.getEnd())
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return updatedContent
}

// modify cqrs.json
function updateCqrsTable(tree: Tree, options: ModuleOptions) {
  const cqrsTablePath = 'prisma/dynamodbs/cqrs.json'
  const isCqrsTableExists = tree.exists(cqrsTablePath)
  if (isCqrsTableExists) {
    const fileContent = tree.read(cqrsTablePath)?.toString()
    const jsonContent = JSON.parse(fileContent.toString())
    jsonContent.push(strings.dasherize(options.name))

    tree.overwrite(cqrsTablePath, JSON.stringify(jsonContent, null, 2))
    return tree
  }
}

// modify prisma.schema
function updatePrismaSchema(tree: Tree, options: ModuleOptions) {
  const schemaPath = 'prisma/schema.prisma'
  const isSchemaExists = tree.exists(schemaPath)
  if (isSchemaExists) {
    const fileContent = tree.read(schemaPath)?.toString('utf-8')
    const stringToAppend = generateModelTemplate(options.name)
    const updatedContent = fileContent + stringToAppend
    tree.overwrite(schemaPath, updatedContent)
    return tree
  }
}

// modify serverless.yaml
function updateServerlessYaml(tree: Tree, options: ModuleOptions) {
  const serverlessPath = 'infra-local/serverless.yml'
  const isServerlessExists = tree.exists(serverlessPath)
  if (isServerlessExists) {
    const fileContent = tree.read(serverlessPath)?.toString('utf-8')
    const newStreamEvent = {
      type: 'dynamodb',
      maximumRetryAttempts: 10,
      arn: '${env:LOCAL_DDB_%%TABLE_NAME%%_STREAM}'.replace(
        '%%TABLE_NAME%%',
        options.name.toUpperCase(),
      ),
      filterPatterns: [{ eventName: ['INSERT'] }],
    }
    const doc = parseDocument(fileContent)
    const mainFunction: any = doc.getIn(['functions', 'main'])
    const events = mainFunction.get('events')
    events.items.push({ stream: newStreamEvent })
    const updatedYamlContent = stringify(doc)

    tree.overwrite(serverlessPath, updatedYamlContent)
    return tree
  }
}

const generateModelTemplate = (name: string) =>
  `
model ${strings.classify(name)} {
  id             String   @id
  cpk            String // コマンド用PK
  csk            String // コマンド用SK
  pk             String // データ用PK, ${name.toUpperCase()}#tenantCode (テナントコード)
  sk             String // データ用SK, マスタ種別コード#マスタコード
  tenantCode     String   @map("tenant_code") // テナントコード, 【テナントコードマスタ】
  seq            Int      @default(0) // 並び順, 採番機能を使用する
  code           String // レコードのコード, マスタ種別コード#マスタコード
  name           String // レコード名, 名前
  version        Int // バージョン
  isDeleted      Boolean  @default(false) @map("is_deleted") // 削除フラグ
  createdBy      String   @default("") @map("created_by") // 作成者
  createdIp      String   @default("") @map("created_ip") // 作成IP, IPv6も考慮する
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamp(0) // 作成日時
  updatedBy      String   @default("") @map("updated_by") // 更新者
  updatedIp      String   @default("") @map("updated_ip") // 更新IP, IPv6も考慮する
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamp(0) // 更新日時

  attributes Json? @map("attributes")

  @@unique([cpk, csk])
  @@unique([pk, sk])
  @@unique([tenantCode, code])
  @@index([tenantCode, name])
  @@map("${strings.underscore(name)}s")
}
`
