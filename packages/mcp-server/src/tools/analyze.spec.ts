import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { getAnalyzeTools, handleAnalyzeTool } from './analyze'

describe('analyze tools', () => {
  describe('getAnalyzeTools', () => {
    it('should return all analyze tools', () => {
      const tools = getAnalyzeTools()
      expect(tools).toHaveLength(5)
      
      const toolNames = tools.map(t => t.name)
      expect(toolNames).toContain('mbc_analyze_project')
      expect(toolNames).toContain('mbc_lookup_error')
      expect(toolNames).toContain('mbc_check_anti_patterns')
      expect(toolNames).toContain('mbc_health_check')
      expect(toolNames).toContain('mbc_explain_code')
    })
  })

  describe('mbc_check_anti_patterns', () => {
    let testDir: string

    beforeEach(() => {
      testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbc-test-'))
      fs.mkdirSync(path.join(testDir, 'src'), { recursive: true })
    })

    afterEach(() => {
      fs.rmSync(testDir, { recursive: true, force: true })
    })

    it('should detect direct DynamoDB write (AP001)', async () => {
      const testFile = path.join(testDir, 'src', 'test.ts')
      fs.writeFileSync(testFile, `
        const command = new PutItemCommand({ TableName: 'test' })
      `)

      const result = await handleAnalyzeTool(
        'mbc_check_anti_patterns',
        { path: 'src' },
        testDir
      )

      expect(result.content[0].text).toContain('AP001')
      expect(result.content[0].text).toContain('Direct DynamoDB Write')
    })

    it('should detect hardcoded tenant (AP005)', async () => {
      const testFile = path.join(testDir, 'src', 'test.ts')
      fs.writeFileSync(testFile, `
        const pk = "TENANT#hardcoded"
      `)

      const result = await handleAnalyzeTool(
        'mbc_check_anti_patterns',
        { path: 'src' },
        testDir
      )

      expect(result.content[0].text).toContain('AP005')
      expect(result.content[0].text).toContain('Hardcoded Tenant')
    })

    it('should detect hardcoded secret (AP008)', async () => {
      const testFile = path.join(testDir, 'src', 'test.ts')
      fs.writeFileSync(testFile, `
        const password = "supersecretpassword123"
      `)

      const result = await handleAnalyzeTool(
        'mbc_check_anti_patterns',
        { path: 'src' },
        testDir
      )

      expect(result.content[0].text).toContain('AP008')
      expect(result.content[0].text).toContain('Hardcoded Secret')
    })

    it('should detect heavy module import (AP010)', async () => {
      const testFile = path.join(testDir, 'src', 'test.ts')
      fs.writeFileSync(testFile, `import * as _ from 'lodash'`)

      const result = await handleAnalyzeTool(
        'mbc_check_anti_patterns',
        { path: 'src' },
        testDir
      )

      expect(result.content[0].text).toContain('AP010')
      expect(result.content[0].text).toContain('Heavy Module Import')
    })

    it('should return success when no anti-patterns found', async () => {
      const testFile = path.join(testDir, 'src', 'test.ts')
      fs.writeFileSync(testFile, `
        export class TestService {
          async doSomething() {
            return 'hello'
          }
        }
      `)

      const result = await handleAnalyzeTool(
        'mbc_check_anti_patterns',
        { path: 'src' },
        testDir
      )

      expect(result.content[0].text).toContain('No anti-patterns detected')
    })

    it('should skip test files', async () => {
      const testFile = path.join(testDir, 'src', 'test.spec.ts')
      fs.writeFileSync(testFile, `
        const password = "supersecretpassword123"
      `)

      const result = await handleAnalyzeTool(
        'mbc_check_anti_patterns',
        { path: 'src' },
        testDir
      )

      expect(result.content[0].text).toContain('No anti-patterns detected')
    })

    it('should return error for non-existent path', async () => {
      const result = await handleAnalyzeTool(
        'mbc_check_anti_patterns',
        { path: 'nonexistent' },
        testDir
      )

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Path not found')
    })
  })

  describe('mbc_health_check', () => {
    let testDir: string

    beforeEach(() => {
      testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbc-test-'))
    })

    afterEach(() => {
      fs.rmSync(testDir, { recursive: true, force: true })
    })

    it('should detect healthy project with MBC packages', async () => {
      fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({
        name: 'test-project',
        dependencies: {
          '@mbc-cqrs-serverless/core': '^1.0.0',
          '@nestjs/common': '^10.0.0',
        },
        devDependencies: {
          typescript: '^5.0.0',
        },
      }))
      fs.mkdirSync(path.join(testDir, 'src'), { recursive: true })
      fs.writeFileSync(path.join(testDir, 'src', 'app.module.ts'), '')
      fs.writeFileSync(path.join(testDir, '.env'), '')
      fs.writeFileSync(path.join(testDir, 'serverless.yml'), '')

      const result = await handleAnalyzeTool(
        'mbc_health_check',
        {},
        testDir
      )

      expect(result.content[0].text).toContain('HEALTHY')
      expect(result.content[0].text).toContain('MBC Framework')
    })

    it('should detect missing MBC packages', async () => {
      fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({
        name: 'test-project',
        dependencies: {
          '@nestjs/common': '^10.0.0',
        },
      }))
      fs.mkdirSync(path.join(testDir, 'src'), { recursive: true })

      const result = await handleAnalyzeTool(
        'mbc_health_check',
        {},
        testDir
      )

      expect(result.content[0].text).toContain('ERROR')
      expect(result.content[0].text).toContain('No @mbc-cqrs-serverless packages found')
    })

    it('should handle invalid package.json', async () => {
      fs.writeFileSync(path.join(testDir, 'package.json'), 'invalid json')
      fs.mkdirSync(path.join(testDir, 'src'), { recursive: true })

      const result = await handleAnalyzeTool(
        'mbc_health_check',
        {},
        testDir
      )

      expect(result.content[0].text).toContain('ERROR')
      expect(result.content[0].text).toContain('could not be parsed')
    })

    it('should detect missing package.json', async () => {
      const result = await handleAnalyzeTool(
        'mbc_health_check',
        {},
        testDir
      )

      expect(result.content[0].text).toContain('ERROR')
      expect(result.content[0].text).toContain('package.json not found')
    })
  })

  describe('mbc_explain_code', () => {
    let testDir: string

    beforeEach(() => {
      testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbc-test-'))
    })

    afterEach(() => {
      fs.rmSync(testDir, { recursive: true, force: true })
    })

    it('should detect NestJS module', async () => {
      const testFile = path.join(testDir, 'app.module.ts')
      fs.writeFileSync(testFile, `
        @Module({
          imports: [CommandModule],
          providers: [AppService],
        })
        export class AppModule {}
      `)

      const result = await handleAnalyzeTool(
        'mbc_explain_code',
        { file_path: 'app.module.ts' },
        testDir
      )

      expect(result.content[0].text).toContain('NestJS Module')
      expect(result.content[0].text).toContain('CommandModule')
    })

    it('should detect REST controller', async () => {
      const testFile = path.join(testDir, 'app.controller.ts')
      fs.writeFileSync(testFile, `
        @Controller('api')
        export class AppController {
          @Get()
          findAll() {}
          
          @Post()
          create() {}
        }
      `)

      const result = await handleAnalyzeTool(
        'mbc_explain_code',
        { file_path: 'app.controller.ts' },
        testDir
      )

      expect(result.content[0].text).toContain('REST Controller')
      expect(result.content[0].text).toContain('GET endpoint')
      expect(result.content[0].text).toContain('POST endpoint')
    })

    it('should detect service with CommandService', async () => {
      const testFile = path.join(testDir, 'app.service.ts')
      fs.writeFileSync(testFile, `
        @Injectable()
        export class AppService {
          constructor(private commandService: CommandService) {}
          
          async create() {
            await this.commandService.publishAsync(...)
          }
        }
      `)

      const result = await handleAnalyzeTool(
        'mbc_explain_code',
        { file_path: 'app.service.ts' },
        testDir
      )

      expect(result.content[0].text).toContain('Service')
      expect(result.content[0].text).toContain('CommandService')
      expect(result.content[0].text).toContain('publishAsync')
    })

    it('should detect entity with DynamoDB keys', async () => {
      const testFile = path.join(testDir, 'item.entity.ts')
      fs.writeFileSync(testFile, `
        export class ItemEntity extends CommandEntity {
          pk: string
          sk: string
          name: string
        }
      `)

      const result = await handleAnalyzeTool(
        'mbc_explain_code',
        { file_path: 'item.entity.ts' },
        testDir
      )

      expect(result.content[0].text).toContain('Entity')
      expect(result.content[0].text).toContain('Command entity')
      expect(result.content[0].text).toContain('partition key')
    })

    it('should return error for non-existent file', async () => {
      const result = await handleAnalyzeTool(
        'mbc_explain_code',
        { file_path: 'nonexistent.ts' },
        testDir
      )

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('File not found')
    })

    it('should explain specific line range', async () => {
      const testFile = path.join(testDir, 'test.ts')
      fs.writeFileSync(testFile, `line1
line2
line3
line4
line5`)

      const result = await handleAnalyzeTool(
        'mbc_explain_code',
        { file_path: 'test.ts', start_line: 2, end_line: 4 },
        testDir
      )

      expect(result.content[0].text).toContain('lines 2-4')
      expect(result.content[0].text).toContain('line2')
      expect(result.content[0].text).toContain('line4')
    })
  })
})
