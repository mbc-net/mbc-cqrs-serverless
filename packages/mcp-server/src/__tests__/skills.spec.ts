import * as fs from 'fs'
import * as path from 'path'

describe('Claude Code Skills', () => {
  const skillsDir = path.join(__dirname, '../../skills')

  describe('Skills directory structure', () => {
    it('should have skills directory', () => {
      expect(fs.existsSync(skillsDir)).toBe(true)
    })

    it('should have mbc-generate skill', () => {
      const skillPath = path.join(skillsDir, 'mbc-generate/SKILL.md')
      expect(fs.existsSync(skillPath)).toBe(true)
    })

    it('should have mbc-review skill', () => {
      const skillPath = path.join(skillsDir, 'mbc-review/SKILL.md')
      expect(fs.existsSync(skillPath)).toBe(true)
    })

    it('should have mbc-migrate skill', () => {
      const skillPath = path.join(skillsDir, 'mbc-migrate/SKILL.md')
      expect(fs.existsSync(skillPath)).toBe(true)
    })

    it('should have mbc-debug skill', () => {
      const skillPath = path.join(skillsDir, 'mbc-debug/SKILL.md')
      expect(fs.existsSync(skillPath)).toBe(true)
    })
  })

  describe('mbc-generate skill', () => {
    const skillPath = path.join(skillsDir, 'mbc-generate/SKILL.md')
    let content: string

    beforeAll(() => {
      content = fs.readFileSync(skillPath, 'utf-8')
    })

    it('should have valid YAML frontmatter', () => {
      expect(content).toMatch(/^---\n/)
      expect(content).toMatch(/\n---\n/)
    })

    it('should have name field in frontmatter', () => {
      expect(content).toMatch(/name:\s*mbc-generate/)
    })

    it('should have description field in frontmatter', () => {
      expect(content).toMatch(/description:\s*.+/)
    })

    it('should contain module generation template', () => {
      expect(content).toContain('Module File')
      expect(content).toContain('.module.ts')
    })

    it('should contain controller generation template', () => {
      expect(content).toContain('Controller File')
      expect(content).toContain('.controller.ts')
    })

    it('should contain service generation template', () => {
      expect(content).toContain('Service File')
      expect(content).toContain('.service.ts')
    })

    it('should contain DTO templates', () => {
      expect(content).toContain('create-[entity].dto.ts')
      expect(content).toContain('update-[entity].dto.ts')
      expect(content).toContain('search-[entity].dto.ts')
    })

    it('should contain DataSyncHandler template', () => {
      expect(content).toContain('DataSyncHandler')
      expect(content).toContain('IDataSyncHandler')
    })

    it('should include best practices', () => {
      expect(content).toContain('publishAsync')
      expect(content).toContain('VERSION_FIRST')
      expect(content).toContain('tenantCode')
      expect(content).toContain('generateId')
    })

    it('should include naming conventions', () => {
      expect(content).toContain('Naming Conventions')
      expect(content).toContain('PascalCase')
      expect(content).toContain('kebab-case')
    })
  })

  describe('mbc-review skill', () => {
    const skillPath = path.join(skillsDir, 'mbc-review/SKILL.md')
    let content: string

    beforeAll(() => {
      content = fs.readFileSync(skillPath, 'utf-8')
    })

    it('should have valid YAML frontmatter', () => {
      expect(content).toMatch(/^---\n/)
      expect(content).toMatch(/\n---\n/)
    })

    it('should have name field in frontmatter', () => {
      expect(content).toMatch(/name:\s*mbc-review/)
    })

    it('should have description field in frontmatter', () => {
      expect(content).toMatch(/description:\s*.+/)
    })

    it('should contain anti-pattern AP001 (publishSync)', () => {
      expect(content).toContain('AP001')
      expect(content).toContain('publishSync')
    })

    it('should contain anti-pattern AP002 (tenantCode)', () => {
      expect(content).toContain('AP002')
      expect(content).toContain('tenantCode')
    })

    it('should contain anti-pattern AP003 (version)', () => {
      expect(content).toContain('AP003')
      expect(content).toContain('VERSION_FIRST')
    })

    it('should contain anti-pattern AP004 (DataSyncHandler)', () => {
      expect(content).toContain('AP004')
      expect(content).toContain('DataSyncHandler')
    })

    it('should contain anti-pattern AP005 (ConditionalCheckFailedException)', () => {
      expect(content).toContain('AP005')
      expect(content).toContain('ConditionalCheckFailedException')
    })

    it('should contain anti-pattern AP006 (PK/SK format)', () => {
      expect(content).toContain('AP006')
      expect(content).toContain('ENTITY#')
    })

    it('should contain anti-pattern AP007 (invokeContext)', () => {
      expect(content).toContain('AP007')
      expect(content).toContain('invokeContext')
    })

    it('should contain anti-pattern AP008 (generateId)', () => {
      expect(content).toContain('AP008')
      expect(content).toContain('generateId')
    })

    it('should contain anti-pattern AP009 (DTO validation)', () => {
      expect(content).toContain('AP009')
      expect(content).toContain('class-validator')
    })

    it('should contain anti-pattern AP010 (deprecated methods)', () => {
      expect(content).toContain('AP010')
      expect(content).toContain('deprecated')
    })

    it('should contain anti-pattern AP011 (getCommandSource)', () => {
      expect(content).toContain('AP011')
      expect(content).toContain('getCommandSource')
    })

    it('should contain anti-pattern AP012 (DataService)', () => {
      expect(content).toContain('AP012')
      expect(content).toContain('DataService')
    })

    it('should contain anti-pattern AP013 (DataSyncHandler type)', () => {
      expect(content).toContain('AP013')
      expect(content).toContain('type')
    })

    it('should contain anti-pattern AP014 (DetailKey)', () => {
      expect(content).toContain('AP014')
      expect(content).toContain('DetailKey')
    })

    it('should contain anti-pattern AP015 (hardcoded table names)', () => {
      expect(content).toContain('AP015')
      expect(content).toContain('Table')
    })

    it('should contain anti-pattern AP016 (error logging)', () => {
      expect(content).toContain('AP016')
      expect(content).toContain('logger')
    })

    it('should contain anti-pattern AP017 (attribute merging)', () => {
      expect(content).toContain('AP017')
      expect(content).toContain('attributes')
    })

    it('should contain anti-pattern AP018 (Swagger)', () => {
      expect(content).toContain('AP018')
      expect(content).toContain('Swagger')
    })

    it('should contain anti-pattern AP019 (pagination)', () => {
      expect(content).toContain('AP019')
      expect(content).toContain('pagination')
    })

    it('should contain anti-pattern AP020 (circular dependencies)', () => {
      expect(content).toContain('AP020')
      expect(content).toContain('Circular')
    })

    it('should have severity levels', () => {
      expect(content).toContain('Severity')
      expect(content).toContain('Error')
      expect(content).toContain('Warning')
    })

    it('should contain review checklist', () => {
      expect(content).toContain('Review Checklist')
      expect(content).toContain('Module Structure')
      expect(content).toContain('Service Layer')
      expect(content).toContain('Error Handling')
    })

    it('should contain output format', () => {
      expect(content).toContain('Output Format')
      expect(content).toContain('Issues Found')
      expect(content).toContain('Suggested Fix')
    })
  })

  describe('mbc-migrate skill', () => {
    const skillPath = path.join(skillsDir, 'mbc-migrate/SKILL.md')
    let content: string

    beforeAll(() => {
      content = fs.readFileSync(skillPath, 'utf-8')
    })

    it('should have valid YAML frontmatter', () => {
      expect(content).toMatch(/^---\n/)
      expect(content).toMatch(/\n---\n/)
    })

    it('should have name field in frontmatter', () => {
      expect(content).toMatch(/name:\s*mbc-migrate/)
    })

    it('should have description field in frontmatter', () => {
      expect(content).toMatch(/description:\s*.+/)
    })

    it('should contain version migration matrix', () => {
      expect(content).toContain('Version Migration Matrix')
      expect(content).toContain('v1.0.17')
      expect(content).toContain('v1.0.21')
    })

    it('should contain migration guides', () => {
      expect(content).toContain('Migration Guide')
      expect(content).toContain('Breaking Change')
    })

    it('should contain deprecated API migration', () => {
      expect(content).toContain('Deprecated API')
      expect(content).toContain('publishAsync')
    })

    it('should contain migration checklist', () => {
      expect(content).toContain('Migration Checklist')
      expect(content).toContain('Before Migration')
      expect(content).toContain('After Migration')
    })

    it('should contain version compatibility matrix', () => {
      expect(content).toContain('Version Compatibility')
      expect(content).toContain('NestJS')
      expect(content).toContain('Node.js')
    })
  })

  describe('mbc-debug skill', () => {
    const skillPath = path.join(skillsDir, 'mbc-debug/SKILL.md')
    let content: string

    beforeAll(() => {
      content = fs.readFileSync(skillPath, 'utf-8')
    })

    it('should have valid YAML frontmatter', () => {
      expect(content).toMatch(/^---\n/)
      expect(content).toMatch(/\n---\n/)
    })

    it('should have name field in frontmatter', () => {
      expect(content).toMatch(/name:\s*mbc-debug/)
    })

    it('should have description field in frontmatter', () => {
      expect(content).toMatch(/description:\s*.+/)
    })

    it('should contain error code lookup', () => {
      expect(content).toContain('Error Code')
      expect(content).toContain('MBC-CMD')
      expect(content).toContain('MBC-DDB')
    })

    it('should contain debugging workflows', () => {
      expect(content).toContain('Debugging Workflow')
      expect(content).toContain('Debug Steps')
    })

    it('should contain ConditionalCheckFailedException handling', () => {
      expect(content).toContain('ConditionalCheckFailedException')
      expect(content).toContain('Version conflict')
    })

    it('should contain DataSyncHandler troubleshooting', () => {
      expect(content).toContain('DataSyncHandler')
      expect(content).toContain('Debug Checklist')
    })

    it('should contain CloudWatch log queries', () => {
      expect(content).toContain('CloudWatch')
      expect(content).toContain('Log Queries')
    })

    it('should contain local development debugging', () => {
      expect(content).toContain('LocalStack')
      expect(content).toContain('Serverless Offline')
    })

    it('should contain troubleshooting decision tree', () => {
      expect(content).toContain('Decision Tree')
      expect(content).toContain('Error Occurred')
    })
  })

  describe('Skill content validation', () => {
    it('should have consistent code block formatting', () => {
      const skills = ['mbc-generate', 'mbc-review', 'mbc-migrate', 'mbc-debug']

      skills.forEach(skillName => {
        const skillPath = path.join(skillsDir, skillName, 'SKILL.md')
        const content = fs.readFileSync(skillPath, 'utf-8')

        // Check for properly closed code blocks
        const codeBlockStarts = (content.match(/```typescript/g) || []).length
        const codeBlockEnds = (content.match(/```\n/g) || []).length

        // Each code block should have a closing
        expect(codeBlockStarts).toBeLessThanOrEqual(codeBlockEnds)
      })
    })

    it('should not contain placeholder text', () => {
      const skills = ['mbc-generate', 'mbc-review', 'mbc-migrate', 'mbc-debug']

      skills.forEach(skillName => {
        const skillPath = path.join(skillsDir, skillName, 'SKILL.md')
        const content = fs.readFileSync(skillPath, 'utf-8')

        // Should not contain common placeholder patterns
        expect(content).not.toContain('TODO:')
        expect(content).not.toContain('FIXME:')
        expect(content).not.toContain('XXX:')
      })
    })

    it('should have all skills with valid YAML frontmatter', () => {
      const skills = ['mbc-generate', 'mbc-review', 'mbc-migrate', 'mbc-debug']

      skills.forEach(skillName => {
        const skillPath = path.join(skillsDir, skillName, 'SKILL.md')
        const content = fs.readFileSync(skillPath, 'utf-8')

        // Check YAML frontmatter structure
        expect(content).toMatch(/^---\n/)
        expect(content).toMatch(/name:\s*\S+/)
        expect(content).toMatch(/description:\s*.+/)
        expect(content).toMatch(/\n---\n/)
      })
    })
  })
})
