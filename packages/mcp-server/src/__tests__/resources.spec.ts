import { registerResources, handleResourceRead } from '../resources/index'

describe('MCP Resources', () => {
  describe('registerResources', () => {
    it('should return all available resources', () => {
      const resources = registerResources()

      expect(Array.isArray(resources)).toBe(true)
      expect(resources.length).toBeGreaterThan(0)

      // Check documentation resources
      const docOverview = resources.find((r) => r.uri === 'mbc://docs/overview')
      expect(docOverview).toBeDefined()
      expect(docOverview?.name).toBe('Framework Overview')

      const errorCatalog = resources.find((r) => r.uri === 'mbc://docs/errors')
      expect(errorCatalog).toBeDefined()
      expect(errorCatalog?.name).toBe('Error Catalog')

      // Check project resources
      const projectEntities = resources.find(
        (r) => r.uri === 'mbc://project/entities'
      )
      expect(projectEntities).toBeDefined()

      const projectModules = resources.find(
        (r) => r.uri === 'mbc://project/modules'
      )
      expect(projectModules).toBeDefined()
    })

    it('should have valid resource structure', () => {
      const resources = registerResources()

      resources.forEach((resource) => {
        expect(resource).toHaveProperty('uri')
        expect(resource).toHaveProperty('name')
        expect(resource).toHaveProperty('description')
        expect(resource.uri).toMatch(/^mbc:\/\//)
      })
    })
  })

  describe('handleResourceRead', () => {
    const projectPath = process.cwd()

    it('should read documentation resource', async () => {
      const result = await handleResourceRead(
        'mbc://docs/errors',
        projectPath
      )

      expect(result).toHaveProperty('contents')
      expect(Array.isArray(result.contents)).toBe(true)
      expect(result.contents.length).toBeGreaterThan(0)
      expect(result.contents[0]).toHaveProperty('uri')
      expect(result.contents[0]).toHaveProperty('text')
    })

    it('should read project entities resource', async () => {
      const result = await handleResourceRead(
        'mbc://project/entities',
        projectPath
      )

      expect(result).toHaveProperty('contents')
      expect(result.contents[0].mimeType).toBe('application/json')

      // Should be valid JSON
      const parsed = JSON.parse(result.contents[0].text)
      expect(Array.isArray(parsed)).toBe(true)
    })

    it('should read project modules resource', async () => {
      const result = await handleResourceRead(
        'mbc://project/modules',
        projectPath
      )

      expect(result).toHaveProperty('contents')
      expect(result.contents[0].mimeType).toBe('application/json')

      // Should be valid JSON
      const parsed = JSON.parse(result.contents[0].text)
      expect(Array.isArray(parsed)).toBe(true)
    })

    it('should read project structure resource', async () => {
      const result = await handleResourceRead(
        'mbc://project/structure',
        projectPath
      )

      expect(result).toHaveProperty('contents')
      expect(result.contents[0].mimeType).toBe('text/plain')
      expect(typeof result.contents[0].text).toBe('string')
    })

    it('should throw error for unknown resource', async () => {
      await expect(
        handleResourceRead('mbc://unknown/resource', projectPath)
      ).rejects.toThrow()
    })
  })
})
