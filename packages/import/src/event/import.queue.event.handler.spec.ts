/**
 * ImportQueueEventHandler Unit Tests
 *
 * 概要 / Overview:
 * ImportQueueEventHandlerのユニットテストスイート。エラーハンドリングと
 * 親ジョブカウンター更新の正確性を検証します。
 *
 * Unit test suite for ImportQueueEventHandler. Verifies error handling
 * and parent job counter update accuracy.
 *
 * 目的 / Purpose:
 * - エラー発生時に親ジョブのカウンターが更新されることを検証
 * - エラー発生時にLambdaがクラッシュしないことを検証
 * - 正常処理時の動作を検証
 *
 * - Verify parent job counters are updated when errors occur
 * - Verify Lambda doesn't crash on errors
 * - Verify normal processing behavior
 */
import { Test, TestingModule } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'
import { KEY_SEPARATOR } from '@mbc-cqrs-serverless/core'
import { ImportQueueEventHandler } from './import.queue.event.handler'
import { ImportService } from '../import.service'
import { ImportQueueEvent } from './import.queue.event'
import { ImportStatusEnum } from '../enum'
import { CSV_IMPORT_PK_PREFIX, IMPORT_PK_PREFIX } from '../constant'
import { PROCESS_STRATEGY_MAP } from '../import.module-definition'
import { IProcessStrategy } from '../interface/processing-strategy.interface'
import { ComparisonStatus } from '../enum/comparison-status.enum'

describe('ImportQueueEventHandler', () => {
  let handler: ImportQueueEventHandler
  let importService: jest.Mocked<ImportService>
  let mockStrategy: jest.Mocked<IProcessStrategy<any, any>>
  let strategyMap: Map<string, IProcessStrategy<any, any>>

  const mockTenantCode = 'tenant001'
  const mockParentPk = `${CSV_IMPORT_PK_PREFIX}${KEY_SEPARATOR}${mockTenantCode}`
  const mockParentSk = 'building#01PARENT123'
  const mockChildPk = `${IMPORT_PK_PREFIX}${KEY_SEPARATOR}${mockTenantCode}`
  const mockChildSk = `${mockParentPk}${KEY_SEPARATOR}${mockParentSk}${KEY_SEPARATOR}01CHILD456`

  beforeEach(async () => {
    mockStrategy = {
      compare: jest.fn(),
      map: jest.fn(),
      getCommandService: jest.fn(),
    } as any

    strategyMap = new Map()
    strategyMap.set('building', mockStrategy)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportQueueEventHandler,
        {
          provide: ImportService,
          useValue: createMock<ImportService>(),
        },
        {
          provide: PROCESS_STRATEGY_MAP,
          useValue: strategyMap,
        },
      ],
    }).compile()

    handler = module.get<ImportQueueEventHandler>(ImportQueueEventHandler)
    importService = module.get(ImportService) as jest.Mocked<ImportService>

    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(handler).toBeDefined()
  })

  describe('execute', () => {
    /**
     * Test: Should skip non-IMPORT jobs
     * IMPORT以外のジョブはスキップすること
     */
    it('should skip jobs that do not start with IMPORT prefix', async () => {
      const event = createMockEvent({
        pk: 'OTHER_PREFIX#tenant001',
        sk: mockChildSk,
        tableName: 'building',
      })

      await handler.execute(event)

      expect(importService.updateStatus).not.toHaveBeenCalled()
    })

    /**
     * Test: Should handle missing strategy gracefully
     * ストラテジーが見つからない場合のエラーハンドリング
     */
    it('should mark job as FAILED when no strategy found', async () => {
      const event = createMockEvent({
        pk: mockChildPk,
        sk: mockChildSk,
        tableName: 'unknown_table',
      })

      await handler.execute(event)

      expect(importService.updateStatus).toHaveBeenCalledWith(
        { pk: mockChildPk, sk: mockChildSk },
        ImportStatusEnum.FAILED,
        expect.objectContaining({
          error: expect.stringContaining('No import strategies registered'),
        }),
      )
    })
  })

  describe('handleImport - error handling', () => {
    /**
     * Test: Should call incrementParentJobCounters when strategy throws error
     * ストラテジーがエラーを投げた時にincrementParentJobCountersが呼ばれること
     */
    it('should call incrementParentJobCounters with false when error occurs', async () => {
      const event = createMockEvent({
        pk: mockChildPk,
        sk: mockChildSk,
        tableName: 'building',
      })

      // Mock strategy to throw error
      const error = new Error('ConditionalCheckFailedException: The conditional request failed')
      mockStrategy.compare.mockRejectedValue(error)

      await handler.execute(event)

      // Verify incrementParentJobCounters was called with false (failure)
      expect(importService.incrementParentJobCounters).toHaveBeenCalledWith(
        { pk: mockParentPk, sk: mockParentSk },
        false,
      )
    })

    /**
     * Test: Should not throw error after handling (prevent Lambda crash)
     * エラーハンドリング後に例外を投げないこと（Lambdaクラッシュ防止）
     */
    it('should not throw error after handling - prevents Lambda crash', async () => {
      const event = createMockEvent({
        pk: mockChildPk,
        sk: mockChildSk,
        tableName: 'building',
      })

      // Mock strategy to throw error
      mockStrategy.compare.mockRejectedValue(new Error('Test error'))

      // Should not throw
      await expect(handler.execute(event)).resolves.not.toThrow()
    })

    /**
     * Test: Should update child job status to FAILED when error occurs
     * エラー発生時に子ジョブのステータスがFAILEDに更新されること
     */
    it('should update child job status to FAILED when error occurs', async () => {
      const event = createMockEvent({
        pk: mockChildPk,
        sk: mockChildSk,
        tableName: 'building',
      })

      const error = new Error('Test error message')
      mockStrategy.compare.mockRejectedValue(error)

      await handler.execute(event)

      // Verify child job status was set to FAILED
      expect(importService.updateStatus).toHaveBeenCalledWith(
        { pk: mockChildPk, sk: mockChildSk },
        ImportStatusEnum.FAILED,
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Test error message',
          }),
        }),
      )
    })

    /**
     * Test: Should publish alarm when error occurs
     * エラー発生時にアラームが発行されること
     */
    it('should publish alarm when error occurs', async () => {
      const event = createMockEvent({
        pk: mockChildPk,
        sk: mockChildSk,
        tableName: 'building',
      })

      const error = new Error('Test error')
      mockStrategy.compare.mockRejectedValue(error)

      await handler.execute(event)

      expect(importService.publishAlarm).toHaveBeenCalled()
    })
  })

  describe('handleImport - success path', () => {
    /**
     * Test: Should update status to PROCESSING when starting
     * 処理開始時にステータスがPROCESSINGに更新されること
     */
    it('should update status to PROCESSING when starting', async () => {
      const event = createMockEvent({
        pk: mockChildPk,
        sk: mockChildSk,
        tableName: 'building',
      })

      mockStrategy.compare.mockResolvedValue({
        status: ComparisonStatus.EQUAL,
        existingData: {},
      })

      await handler.execute(event)

      expect(importService.updateStatus).toHaveBeenCalledWith(
        { pk: mockChildPk, sk: mockChildSk },
        ImportStatusEnum.PROCESSING,
      )
    })

    /**
     * Test: Should call incrementParentJobCounters with true on success (EQUAL status)
     * 成功時（EQUAL）にincrementParentJobCountersがtrueで呼ばれること
     */
    it('should call incrementParentJobCounters with true when EQUAL', async () => {
      const event = createMockEvent({
        pk: mockChildPk,
        sk: mockChildSk,
        tableName: 'building',
      })

      mockStrategy.compare.mockResolvedValue({
        status: ComparisonStatus.EQUAL,
        existingData: {},
      })

      await handler.execute(event)

      expect(importService.incrementParentJobCounters).toHaveBeenCalledWith(
        { pk: mockParentPk, sk: mockParentSk },
        true,
      )
    })
  })
})

/**
 * Helper function to create mock ImportQueueEvent
 */
function createMockEvent(params: {
  pk: string
  sk: string
  tableName: string
}): ImportQueueEvent {
  const importEntity = {
    id: `${params.pk}${KEY_SEPARATOR}${params.sk}`,
    pk: params.pk,
    sk: params.sk,
    tenantCode: 'tenant001',
    type: params.tableName,
    attributes: {
      code: 'test-code',
      name: 'Test Item',
    },
  }

  const importKey = {
    pk: params.pk,
    sk: params.sk,
  }

  // Create a mock that provides importEvent property directly
  const mockEvent = {
    source: 'test-source',
    messageId: 'test-message-id',
    receiptHandle: 'test-receipt-handle',
    body: '{}',
    attributes: {} as any,
    messageAttributes: {},
    md5OfBody: '',
    eventSource: '',
    eventSourceARN: '',
    awsRegion: '',
    importEvent: {
      importKey,
      importEntity,
    },
  } as unknown as ImportQueueEvent

  return mockEvent
}
