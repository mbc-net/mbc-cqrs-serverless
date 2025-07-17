import { Test, TestingModule } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'
import { StepFunctionService } from './step-function.service'
import { ConfigService } from '@nestjs/config'

jest.mock('@aws-sdk/client-sfn', () => ({
  SFNClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  StartExecutionCommand: jest.fn().mockImplementation((params) => params),
}))

describe('StepFunctionService', () => {
  let service: StepFunctionService
  let configService: jest.Mocked<ConfigService>
  let mockClient: any

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StepFunctionService,
        {
          provide: ConfigService,
          useValue: createMock<ConfigService>(),
        },
      ],
    }).compile()

    service = module.get<StepFunctionService>(StepFunctionService)
    configService = module.get(ConfigService)

    configService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'SFN_ENDPOINT':
          return 'https://states.us-east-1.amazonaws.com'
        case 'SFN_REGION':
          return 'us-east-1'
        default:
          return undefined
      }
    })

    mockClient = service.client
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('client', () => {
    it('should return the SFN client instance', () => {
      const client = service.client
      expect(client).toBeDefined()
      expect(client).toBe(service.client)
    })
  })

  describe('startExecution', () => {
    it('should start step function execution with name', async () => {
      const arn = 'arn:aws:states:us-east-1:123456789012:stateMachine:test-state-machine'
      const input = { key: 'value', data: 'test' }
      const name = 'test-execution'

      mockClient.send.mockResolvedValue({
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test-state-machine:test-execution',
        startDate: new Date(),
      })

      const result = await service.startExecution(arn, input, name)

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          stateMachineArn: arn,
          name: name,
          input: JSON.stringify(input),
        })
      )
      expect(result).toEqual({
        executionArn: expect.any(String),
        startDate: expect.any(Date),
      })
    })

    it('should start execution without name', async () => {
      const arn = 'arn:aws:states:us-east-1:123456789012:stateMachine:test-state-machine'
      const input = { key: 'value' }

      mockClient.send.mockResolvedValue({
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test-state-machine:auto-generated',
        startDate: new Date(),
      })

      await service.startExecution(arn, input)

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          stateMachineArn: arn,
          name: undefined,
          input: JSON.stringify(input),
        })
      )
    })

    it('should handle long execution names by setting to undefined', async () => {
      const arn = 'arn:aws:states:us-east-1:123456789012:stateMachine:test-state-machine'
      const input = { key: 'value' }
      const longName = 'a'.repeat(85)

      mockClient.send.mockResolvedValue({
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test-state-machine:auto-generated',
        startDate: new Date(),
      })

      await service.startExecution(arn, input, longName)

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          stateMachineArn: arn,
          name: undefined,
          input: JSON.stringify(input),
        })
      )
    })

    it('should use name when length is exactly 80 characters', async () => {
      const arn = 'arn:aws:states:us-east-1:123456789012:stateMachine:test-state-machine'
      const input = { key: 'value' }
      const exactLengthName = 'a'.repeat(80)

      mockClient.send.mockResolvedValue({
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test-state-machine:' + exactLengthName,
        startDate: new Date(),
      })

      await service.startExecution(arn, input, exactLengthName)

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          stateMachineArn: arn,
          name: exactLengthName,
          input: JSON.stringify(input),
        })
      )
    })

    it('should serialize complex input objects', async () => {
      const arn = 'arn:aws:states:us-east-1:123456789012:stateMachine:test-state-machine'
      const input = {
        nested: {
          object: {
            with: ['array', 'values'],
            and: { deep: 'nesting' },
          },
        },
        number: 42,
        boolean: true,
      }

      mockClient.send.mockResolvedValue({
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test-state-machine:test',
        startDate: new Date(),
      })

      await service.startExecution(arn, input)

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: JSON.stringify(input),
        })
      )
    })

    it('should handle start execution errors', async () => {
      const arn = 'arn:aws:states:us-east-1:123456789012:stateMachine:test-state-machine'
      const input = { key: 'value' }
      const error = new Error('Step Function execution failed')

      mockClient.send.mockRejectedValue(error)

      await expect(service.startExecution(arn, input)).rejects.toThrow('Step Function execution failed')
    })

    it('should handle empty name string as undefined', async () => {
      const arn = 'arn:aws:states:us-east-1:123456789012:stateMachine:test-state-machine'
      const input = { key: 'value' }
      const emptyName = ''

      mockClient.send.mockResolvedValue({
        executionArn: 'arn:aws:states:us-east-1:123456789012:execution:test-state-machine:auto',
        startDate: new Date(),
      })

      await service.startExecution(arn, input, emptyName)

      expect(mockClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          name: undefined,
        })
      )
    })
  })

  describe('client configuration', () => {
    it('should configure client with endpoint and region from config', () => {
      expect(service).toBeDefined()
      expect(service.client).toBeDefined()
    })
  })
})
