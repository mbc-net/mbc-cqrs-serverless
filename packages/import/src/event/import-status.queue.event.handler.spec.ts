import { Test, TestingModule } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'
import { StepFunctionService, KEY_SEPARATOR } from '@mbc-cqrs-serverless/core'
import { ImportStatusHandler } from './import-status.queue.event.handler'
import { ImportService } from '../import.service'
import { ImportStatusQueueEvent } from './import-status.queue.event'
import { ImportStatusEnum } from '../enum'
import { CSV_IMPORT_PK_PREFIX } from '../constant'

jest.mock('@aws-sdk/client-sfn', () => ({
  SendTaskSuccessCommand: jest.fn().mockImplementation((params) => params),
  SendTaskFailureCommand: jest.fn().mockImplementation((params) => params),
}))

describe('ImportStatusHandler', () => {
  let handler: ImportStatusHandler
  let importService: jest.Mocked<ImportService>
  let sfnService: jest.Mocked<StepFunctionService>
  let mockSfnClient: { send: jest.Mock }

  const mockTaskToken = 'mock-task-token-12345'
  const mockPk = `${CSV_IMPORT_PK_PREFIX}${KEY_SEPARATOR}tenant001`
  const mockSk = 'building#01ABC123'

  beforeEach(async () => {
    mockSfnClient = {
      send: jest.fn().mockResolvedValue({}),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportStatusHandler,
        {
          provide: ImportService,
          useValue: createMock<ImportService>(),
        },
        {
          provide: StepFunctionService,
          useValue: {
            client: mockSfnClient,
          },
        },
      ],
    }).compile()

    handler = module.get<ImportStatusHandler>(ImportStatusHandler)
    importService = module.get(ImportService) as jest.Mocked<ImportService>
    sfnService = module.get(StepFunctionService) as jest.Mocked<StepFunctionService>

    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(handler).toBeDefined()
  })

  describe('execute', () => {
    describe('filtering', () => {
      it('should skip non-CSV_IMPORT jobs', async () => {
        const event = createMockEvent({
          pk: 'OTHER_PREFIX#tenant001',
          sk: mockSk,
          status: ImportStatusEnum.COMPLETED,
        })

        await handler.execute(event)

        expect(importService.getImportByKey).not.toHaveBeenCalled()
      })

      it('should skip non-terminal status (PROCESSING)', async () => {
        const event = createMockEvent({
          pk: mockPk,
          sk: mockSk,
          status: ImportStatusEnum.PROCESSING,
        })

        await handler.execute(event)

        expect(importService.getImportByKey).not.toHaveBeenCalled()
      })

      it('should skip non-terminal status (CREATED)', async () => {
        const event = createMockEvent({
          pk: mockPk,
          sk: mockSk,
          status: ImportStatusEnum.CREATED,
        })

        await handler.execute(event)

        expect(importService.getImportByKey).not.toHaveBeenCalled()
      })

      it('should process COMPLETED status for CSV_IMPORT jobs', async () => {
        const event = createMockEvent({
          pk: mockPk,
          sk: mockSk,
          status: ImportStatusEnum.COMPLETED,
        })

        importService.getImportByKey.mockResolvedValue({
          pk: mockPk,
          sk: mockSk,
          attributes: {},
          result: { message: 'Success' },
        } as any)

        await handler.execute(event)

        expect(importService.getImportByKey).toHaveBeenCalledWith({
          pk: mockPk,
          sk: mockSk,
        })
      })

      it('should process FAILED status for CSV_IMPORT jobs', async () => {
        const event = createMockEvent({
          pk: mockPk,
          sk: mockSk,
          status: ImportStatusEnum.FAILED,
        })

        importService.getImportByKey.mockResolvedValue({
          pk: mockPk,
          sk: mockSk,
          attributes: {},
          result: { error: 'Some error' },
        } as any)

        await handler.execute(event)

        expect(importService.getImportByKey).toHaveBeenCalledWith({
          pk: mockPk,
          sk: mockSk,
        })
      })
    })

    describe('sendTaskSuccess', () => {
      it('should send task success when COMPLETED with taskToken', async () => {
        const mockResult = { message: 'Import completed', total: 100 }
        const event = createMockEvent({
          pk: mockPk,
          sk: mockSk,
          status: ImportStatusEnum.COMPLETED,
        })

        importService.getImportByKey.mockResolvedValue({
          pk: mockPk,
          sk: mockSk,
          attributes: { taskToken: mockTaskToken },
          result: mockResult,
        } as any)

        await handler.execute(event)

        expect(mockSfnClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            taskToken: mockTaskToken,
            output: JSON.stringify(mockResult),
          }),
        )
      })

      it('should not send callback when no taskToken present', async () => {
        const event = createMockEvent({
          pk: mockPk,
          sk: mockSk,
          status: ImportStatusEnum.COMPLETED,
        })

        importService.getImportByKey.mockResolvedValue({
          pk: mockPk,
          sk: mockSk,
          attributes: {},
          result: { message: 'Success' },
        } as any)

        await handler.execute(event)

        expect(mockSfnClient.send).not.toHaveBeenCalled()
      })
    })

    describe('sendTaskFailure', () => {
      it('should send task failure when FAILED with taskToken', async () => {
        const mockResult = { error: 'Import failed', details: 'Validation error' }
        const event = createMockEvent({
          pk: mockPk,
          sk: mockSk,
          status: ImportStatusEnum.FAILED,
        })

        importService.getImportByKey.mockResolvedValue({
          pk: mockPk,
          sk: mockSk,
          attributes: { taskToken: mockTaskToken },
          result: mockResult,
        } as any)

        await handler.execute(event)

        expect(mockSfnClient.send).toHaveBeenCalledWith(
          expect.objectContaining({
            taskToken: mockTaskToken,
            error: 'ImportFailed',
            cause: JSON.stringify(mockResult),
          }),
        )
      })

      it('should not send failure callback when no taskToken present', async () => {
        const event = createMockEvent({
          pk: mockPk,
          sk: mockSk,
          status: ImportStatusEnum.FAILED,
        })

        importService.getImportByKey.mockResolvedValue({
          pk: mockPk,
          sk: mockSk,
          attributes: {},
          result: { error: 'Some error' },
        } as any)

        await handler.execute(event)

        expect(mockSfnClient.send).not.toHaveBeenCalled()
      })
    })

    describe('error handling', () => {
      it('should handle missing import job gracefully', async () => {
        const event = createMockEvent({
          pk: mockPk,
          sk: mockSk,
          status: ImportStatusEnum.COMPLETED,
        })

        importService.getImportByKey.mockResolvedValue(null as any)

        await handler.execute(event)

        expect(mockSfnClient.send).not.toHaveBeenCalled()
      })

      it('should throw error when importService fails', async () => {
        const event = createMockEvent({
          pk: mockPk,
          sk: mockSk,
          status: ImportStatusEnum.COMPLETED,
        })

        const error = new Error('DynamoDB error')
        importService.getImportByKey.mockRejectedValue(error)

        await expect(handler.execute(event)).rejects.toThrow('DynamoDB error')
      })

      it('should throw error when sfnService fails', async () => {
        const event = createMockEvent({
          pk: mockPk,
          sk: mockSk,
          status: ImportStatusEnum.COMPLETED,
        })

        importService.getImportByKey.mockResolvedValue({
          pk: mockPk,
          sk: mockSk,
          attributes: { taskToken: mockTaskToken },
          result: { message: 'Success' },
        } as any)

        const sfnError = new Error('Step Function error')
        mockSfnClient.send.mockRejectedValue(sfnError)

        await expect(handler.execute(event)).rejects.toThrow('Step Function error')
      })
    })
  })

  describe('sendTaskSuccess', () => {
    it('should send SendTaskSuccessCommand with correct parameters', async () => {
      const output = { total: 100, succeeded: 100 }

      await handler.sendTaskSuccess(mockTaskToken, output)

      expect(mockSfnClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          taskToken: mockTaskToken,
          output: JSON.stringify(output),
        }),
      )
    })
  })

  describe('sendTaskFailure', () => {
    it('should send SendTaskFailureCommand with correct parameters', async () => {
      const cause = { message: 'Validation failed', details: 'Invalid data' }

      await handler.sendTaskFailure(mockTaskToken, 'ImportFailed', cause)

      expect(mockSfnClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          taskToken: mockTaskToken,
          error: 'ImportFailed',
          cause: JSON.stringify(cause),
        }),
      )
    })

    it('should handle null cause', async () => {
      await handler.sendTaskFailure(mockTaskToken, 'ImportFailed', null)

      expect(mockSfnClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          taskToken: mockTaskToken,
          error: 'ImportFailed',
          cause: 'null',
        }),
      )
    })
  })
})

/**
 * Helper function to create mock ImportStatusQueueEvent
 */
function createMockEvent(params: {
  pk: string
  sk: string
  status: ImportStatusEnum
}): ImportStatusQueueEvent {
  const notification = {
    pk: params.pk,
    sk: params.sk,
    id: `${params.pk}#${params.sk}`,
    content: {
      status: params.status,
    },
  }

  return {
    body: JSON.stringify(notification),
  } as ImportStatusQueueEvent
}
