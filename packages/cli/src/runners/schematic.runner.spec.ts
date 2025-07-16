import { SchematicRunner } from './schematic.runner'
import { AbstractRunner } from './abstract.runner'

jest.mock('./abstract.runner')

describe('Schematic Runner', () => {
  const mockAbstractRunner = AbstractRunner as jest.MockedClass<typeof AbstractRunner>
  const mockRunnerInstance = {
    run: jest.fn(),
    rawFullCommand: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockAbstractRunner.mockImplementation(() => mockRunnerInstance as any)
  })

  describe('Overview: Schematic execution runner functionality', () => {
    describe('Purpose: Test basic schematic runner initialization', () => {
      it('should create schematic runner without errors', () => {
        expect(() => new SchematicRunner()).not.toThrow()
      })

      it('should create schematic runner with default settings', () => {
        expect(() => new SchematicRunner()).not.toThrow()
      })

      it('should initialize AbstractRunner with correct binary path', () => {
        new SchematicRunner()
        
        expect(mockAbstractRunner).toHaveBeenCalledWith(
          'node',
          expect.arrayContaining([expect.stringContaining('schematics.js')])
        )
      })
    })

    describe('Purpose: Test schematic command execution', () => {
      it('should execute schematic command successfully', async () => {
        const runner = new SchematicRunner()
        mockRunnerInstance.run.mockResolvedValue(undefined)

        await runner.run('@mbc-cqrs-serverless/cli:service --name=test-service')

        expect(mockRunnerInstance.run).toHaveBeenCalledWith(
          '@mbc-cqrs-serverless/cli:service --name=test-service'
        )
      })

      it('should handle complex schematic commands with multiple options', async () => {
        const runner = new SchematicRunner()
        mockRunnerInstance.run.mockResolvedValue(undefined)

        const command = '@mbc-cqrs-serverless/cli:service --name=test-service --mode=async --schema --dry-run'
        await runner.run(command)

        expect(mockRunnerInstance.run).toHaveBeenCalledWith(command)
      })

      it('should handle schematic commands with quoted arguments', async () => {
        const runner = new SchematicRunner()
        mockRunnerInstance.run.mockResolvedValue(undefined)

        const command = '@mbc-cqrs-serverless/cli:service --name="test service" --description="A test service"'
        await runner.run(command)

        expect(mockRunnerInstance.run).toHaveBeenCalledWith(command)
      })
    })

    describe('Purpose: Test error handling scenarios', () => {
      it('should handle schematic execution failure', async () => {
        const runner = new SchematicRunner()
        mockRunnerInstance.run.mockRejectedValue(new Error('Schematic execution failed'))

        await expect(runner.run('@mbc-cqrs-serverless/cli:service --name=test'))
          .rejects.toThrow('Schematic execution failed')
      })

      it('should handle empty command string', async () => {
        const runner = new SchematicRunner()
        mockRunnerInstance.run.mockResolvedValue(undefined)

        await runner.run('')

        expect(mockRunnerInstance.run).toHaveBeenCalledWith('')
      })

      it('should handle undefined command', async () => {
        const runner = new SchematicRunner()
        mockRunnerInstance.run.mockResolvedValue(undefined)

        await runner.run(undefined as any)

        expect(mockRunnerInstance.run).toHaveBeenCalledWith(undefined)
      })
    })

    describe('Purpose: Test collection name handling', () => {
      it('should use node binary with schematics path', () => {
        new SchematicRunner()
        
        expect(mockAbstractRunner).toHaveBeenCalledWith(
          'node',
          expect.arrayContaining([expect.stringContaining('schematics.js')])
        )
      })

      it('should initialize with node binary and schematics path', () => {
        new SchematicRunner()
        
        expect(mockAbstractRunner).toHaveBeenCalledWith(
          'node',
          expect.arrayContaining([expect.stringContaining('schematics.js')])
        )
      })

      it('should handle binary path resolution', () => {
        new SchematicRunner()
        
        expect(mockAbstractRunner).toHaveBeenCalled()
      })
    })

    describe('Purpose: Test binary path resolution', () => {
      it('should resolve schematics binary path correctly', () => {
        new SchematicRunner()
        
        const binaryPath = mockAbstractRunner.mock.calls[0][0]
        expect(binaryPath).toBe('node')
        
        const args = mockAbstractRunner.mock.calls[0][1]
        expect(args[0]).toContain('schematics.js')
      })

      it('should handle different working directories', () => {
        const originalCwd = process.cwd
        process.cwd = jest.fn().mockReturnValue('/custom/working/directory')

        new SchematicRunner()
        
        expect(mockAbstractRunner).toHaveBeenCalled()
        
        process.cwd = originalCwd
      })
    })

    describe('Purpose: Test command parsing and formatting', () => {
      it('should handle command string correctly', async () => {
        const runner = new SchematicRunner()
        mockRunnerInstance.run.mockResolvedValue(undefined)

        await runner.run('collection:schematic --option1=value1 --option2 --option3=value3')

        expect(mockRunnerInstance.run).toHaveBeenCalledWith(
          'collection:schematic --option1=value1 --option2 --option3=value3'
        )
      })

      it('should handle commands with no options', async () => {
        const runner = new SchematicRunner()
        mockRunnerInstance.run.mockResolvedValue(undefined)

        await runner.run('collection:schematic')

        expect(mockRunnerInstance.run).toHaveBeenCalledWith('collection:schematic')
      })

      it('should handle commands with special characters', async () => {
        const runner = new SchematicRunner()
        mockRunnerInstance.run.mockResolvedValue(undefined)

        await runner.run('collection:schematic --name=test-service_v2.0')

        expect(mockRunnerInstance.run).toHaveBeenCalledWith(
          'collection:schematic --name=test-service_v2.0'
        )
      })
    })

    describe('Purpose: Test concurrent execution scenarios', () => {
      it('should handle multiple concurrent schematic runs', async () => {
        const runner = new SchematicRunner()
        mockRunnerInstance.run.mockResolvedValue(undefined)

        const promises = [
          runner.run('@mbc-cqrs-serverless/cli:service --name=service1'),
          runner.run('@mbc-cqrs-serverless/cli:controller --name=controller1'),
          runner.run('@mbc-cqrs-serverless/cli:entity --name=entity1')
        ]

        await Promise.all(promises)

        expect(mockRunnerInstance.run).toHaveBeenCalledTimes(3)
      })

      it('should handle partial failure in concurrent runs', async () => {
        const runner = new SchematicRunner()
        mockRunnerInstance.run
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error('Execution failed'))
          .mockResolvedValueOnce(undefined)

        const promises = [
          runner.run('@mbc-cqrs-serverless/cli:service --name=service1'),
          runner.run('@mbc-cqrs-serverless/cli:controller --name=controller1'),
          runner.run('@mbc-cqrs-serverless/cli:entity --name=entity1')
        ]

        const results = await Promise.allSettled(promises)

        expect(results[0].status).toBe('fulfilled')
        expect(results[1].status).toBe('rejected')
        expect(results[2].status).toBe('fulfilled')
      })
    })
  })
})
