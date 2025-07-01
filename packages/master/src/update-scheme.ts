import { cpSync, readFileSync, writeFileSync } from 'fs'
import fs from 'fs'
import { resolve } from 'path'
import path from 'path'

import { TABLE_NAME } from './constants'

// [cqrs dynamo]
// Path to the JSON file
const jsonFilePath = resolve(
  __dirname,
  '../../../../prisma/dynamodbs/cqrs.json',
) // Replace with your actual file name
const formatDynamo = async () => {
  try {
    // Read the JSON file
    const rawData = readFileSync(jsonFilePath, 'utf-8')
    const jsonData = JSON.parse(rawData)

    // Ensure jsonData is an array
    if (!Array.isArray(jsonData)) {
      throw new Error('The JSON content is not an array.')
    }

    // Add "master" to the array if it doesn't exist
    if (!jsonData.includes(TABLE_NAME)) {
      jsonData.push(TABLE_NAME)
    }

    // Write the updated JSON back to the file
    writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2), 'utf-8')
  } catch (error) {}
}

// [event factory]
const eventFilePath = resolve(__dirname, '../../../../src/event-factory.ts')
const transformDynamodbStreamFunction = `
  async transformDynamodbStream(event: DynamoDBStreamEvent): Promise<IEvent[]> {
    const curEvents = await super.transformDynamodbStream(event);
    const taskEvents = event.Records.map((record) => {
      if (
        record.eventSourceARN.endsWith('tasks') ||
        record.eventSourceARN.includes('tasks' + '/stream/')
      ) {
        if (record.eventName === 'INSERT') {
          return new TaskEvent().fromDynamoDBRecord(record)
        }
      }
      return undefined;
    }).filter((event) => !!event)

    return [...curEvents, ...taskEvents]
  }
`
const formatEventFactory = async () => {
  try {
    let rawData: string = readFileSync(eventFilePath, 'utf-8')

    // add dynamo stream
    const isAddEventFactory = rawData.includes('transformDynamodbStream')
    if (!isAddEventFactory) {
      const lastBraceIndex = rawData.lastIndexOf('}')
      rawData =
        rawData.substring(0, lastBraceIndex) +
        `\n\n${transformDynamodbStreamFunction}\n` +
        rawData.substring(lastBraceIndex)
    }

    // add import core
    const coreImportPath = '@mbc-cqrs-serverless/core'
    const taskImportPath = '@mbc-cqrs-serverless/task'

    const genericImportStatementRegex =
      /^import\s*\{[\s\S]*?\}\s*from\s*['"]([^'"]+)['"];?\s*\r?\n?/gm
    let currentCoreImportStatement = ''
    let currentTaskImportStatement = ''
    const matches = rawData.match(genericImportStatementRegex)

    // Use a map to store the exact match for each module path for easy access
    const foundImportStatements = new Map()
    if (matches) {
      matches.forEach((fullMatch) => {
        const pathMatch = fullMatch.match(/from\s*['"]([^'"]+)['"]/)
        if (pathMatch && pathMatch[1]) {
          foundImportStatements.set(pathMatch[1], fullMatch)
        }
      })
    }

    // Process the core import
    if (foundImportStatements.has(coreImportPath)) {
      currentCoreImportStatement = foundImportStatements.get(coreImportPath)

      const coreItemsToAdd = ['EventFactory', 'IEvent']
      const coreItemsToRemove = ['DefaultEventFactory']

      const modifiedCoreImportStatement = modifyImportString(
        currentCoreImportStatement,
        coreItemsToAdd,
        coreItemsToRemove,
      )

      rawData = rawData.replace(
        currentCoreImportStatement,
        modifiedCoreImportStatement,
      )
    }

    // Process the task import
    if (foundImportStatements.has(taskImportPath)) {
      currentTaskImportStatement = foundImportStatements.get(taskImportPath)

      const taskItemsToAdd = ['EventFactoryAddedTask', 'TaskEvent']
      const modifiedTaskImportStatement = modifyImportString(
        currentTaskImportStatement,
        taskItemsToAdd,
      )

      rawData = rawData.replace(
        currentTaskImportStatement,
        modifiedTaskImportStatement,
      )
    } else {
      // No import statement found for '${taskImportPath}' in rawData.`,
      const taskImportLine =
        "import { EventFactoryAddedTask, TaskEvent } from '@mbc-cqrs-serverless/task'"
      rawData = taskImportLine + '\n' + rawData
    }

    if (!rawData.includes('aws-lambda')) {
      const awsLambdaImportLine =
        "import { DynamoDBStreamEvent } from 'aws-lambda';"
      rawData = awsLambdaImportLine + '\n' + rawData
    }

    // add EventFactoryAddedTask
    rawData = rawData.replace(
      /export\s+class\s+CustomEventFactory\s+extends\s+DefaultEventFactory\s*{/,
      'export class CustomEventFactory extends EventFactoryAddedTask {',
    )

    writeFileSync(eventFilePath, rawData, 'utf-8')
  } catch (error) {}
}

function modifyImportString(importString, itemsToAdd = [], itemsToRemove = []) {
  // Regex to capture the module path and the content within the curly braces
  const regex = /import\s*\{\s*([\s\S]*?)\s*\}\s*from\s*['"](.*?)['"]/
  const match = importString.match(regex)

  if (!match) {
    // If the regex doesn't match, return the original string or throw an error
    return importString
  }

  const existingItemsString = match[1]
  const modulePath = match[2]

  // Split the existing items string into an array, clean up whitespace, and filter out empty strings
  let items = existingItemsString
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  // Remove specified items
  items = items.filter((item) => !itemsToRemove.includes(item))

  // Add new items, ensuring no duplicates
  const allItems = new Set([...items, ...itemsToAdd])

  const sortedItems = Array.from(allItems).sort()

  // Construct the new import string with proper indentation
  const newImportContent = sortedItems.map((item) => `  ${item},`).join('\n')

  return `import {\n${newImportContent}\n} from '${modulePath}'\n`
}

// [main module]
const formatTemplate = () => {
  const destDir = resolve(__dirname, '../../../../src/custom-task')
  cpSync(path.join(__dirname, '../src/templates/custom-task'), destDir, {
    recursive: true,
  })

  function mergeDirectories(source, destination) {
    // 1. Read all the items (files and directories) in the source folder.
    const sourceItems = fs.readdirSync(source, { withFileTypes: true })

    // 2. Iterate through each item.
    for (const item of sourceItems) {
      const sourcePath = path.join(source, item.name)
      const destinationPath = path.join(destination, item.name)

      if (item.isDirectory()) {
        // If it's a directory, check if the destination directory exists.
        if (!fs.existsSync(destinationPath)) {
          // If not, create it.
          fs.mkdirSync(destinationPath, { recursive: true })
        }
        // Recursively call the function to merge the subdirectories.
        mergeDirectories(sourcePath, destinationPath)
      } else if (item.isFile()) {
        // If it's a file, check if it already exists in the destination.
        if (fs.existsSync(destinationPath)) {
          const contentToAppend = fs.readFileSync(sourcePath)
          fs.appendFileSync(destinationPath, contentToAppend)
        } else {
          // If the file doesn't exist, just copy it.
          fs.copyFileSync(sourcePath, destinationPath)
        }
      }
    }
  }

  const sourceDir = path.join(__dirname, '../src/templates/master')
  const destinationDir = path.resolve(__dirname, '../../../../src/master')

  const fileName = 'handler/master-sfn-task.event.ts'
  const filePath = path.join(destinationDir, fileName)

  // Check if the file exists
  if (!fs.existsSync(destinationDir)) {
    fs.mkdirSync(destinationDir, { recursive: true })
  }
  if (!fs.existsSync(filePath)) {
    mergeDirectories(sourceDir, destinationDir)
  }

  const mainPath = resolve(__dirname, '../../../../src/main.module.ts')
  let rawData: string = readFileSync(mainPath, 'utf-8')
  let needsWrite = false

  if (!rawData.includes('CustomEventFactory')) {
    const eventImportLine =
      "import { CustomEventFactory } from './event-factory'"
    rawData = eventImportLine + '\n' + rawData
    const module = ['CustomEventFactory']
    rawData = appendToProviders(rawData, module)
    needsWrite = true
  }

  if (!rawData.includes('MasterModule')) {
    if (!rawData.includes('./master/master.module')) {
      const awsLambdaImportLine =
        "import { MasterModule } from './master/master.module'"
      rawData = awsLambdaImportLine + '\n' + rawData
      needsWrite = true
    }

    if (!rawData.includes('./custom-task/custom-task.module')) {
      const customTaskLine = `import { CustomTaskModule } from './custom-task/custom-task.module'`
      rawData = customTaskLine + '\n' + rawData
      needsWrite = true
    }

    const modulesToAdd: string[] = ['MasterModule', 'CustomTaskModule']
    rawData = appendModulesAfterOpeningBracket(rawData, modulesToAdd)
    needsWrite = true
  }

  if (needsWrite) {
    writeFileSync(mainPath, rawData, 'utf-8')
  }
}

function appendToProviders(
  codeString: string,
  modulesToAppend: string[],
): string {
  const importsRegex = /(providers:\s*\[\s*)/s
  const formattedModules = modulesToAppend.join(',\n    ')
  const replacement = `$1\n    ${formattedModules},\n    `

  const newCodeString = codeString.replace(importsRegex, replacement)

  return newCodeString
}

function appendModulesAfterOpeningBracket(codeString, modulesToAppend) {
  const importsRegex = /(imports:\s*\[\s*)/s
  const formattedModules = modulesToAppend.join(',\n    ')
  const replacement = `$1\n    ${formattedModules},\n    `

  const newCodeString = codeString.replace(importsRegex, replacement)

  return newCodeString
}

// [prisma]
const masterSchema = `model Master {
  id             String   @id
  cpk            String
  csk            String
  pk             String
  sk             String
  masterType     String   @default("") @map("master_type")
  masterTypeCode String   @map("master_type_code")
  masterCode     String   @map("master_code")
  tenantCode     String   @map("tenant_code")
  seq            Int      @default(0)
  code           String
  name           String
  version        Int
  isDeleted      Boolean  @default(false) @map("is_deleted")
  createdBy      String   @default("") @map("created_by")
  createdIp      String   @default("") @map("created_ip")
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamp(0)
  updatedBy      String   @default("") @map("updated_by")
  updatedIp      String   @default("") @map("updated_ip")
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamp(0)

  attributes Json? @map("attributes")

  @@unique([cpk, csk])
  @@unique([pk, sk])
  @@unique([tenantCode, code])
  @@unique([tenantCode, masterTypeCode, masterCode])
  @@index([tenantCode, name])
  @@map("masters")
}`

const formatPrisma = () => {
  const mainPath = resolve(__dirname, '../../../../prisma/schema.prisma')
  let schemaData: string = readFileSync(mainPath, 'utf-8')
  if (schemaData.includes('model Master')) {
    return
  }

  schemaData += '\n' + masterSchema + '\n'
  writeFileSync(mainPath, schemaData, 'utf-8')
}

try {
  formatDynamo()
  formatEventFactory()
  formatTemplate()
  formatPrisma()
} catch (e) {}
