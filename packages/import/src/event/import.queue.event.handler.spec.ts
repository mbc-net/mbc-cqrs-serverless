/**
 * ImportQueueEventHandler Unit Tests
 *
 * 概要 / Overview:
 * ImportQueueEventHandlerのユニットテストスイート。エラーハンドリング、
 * 親ジョブカウンター更新の正確性、および同期・非同期モードのルーティングを検証します。
 *
 * Unit test suite for ImportQueueEventHandler. Verifies error handling,
 * parent job counter update accuracy, and Sync/Async mode routing.
 *
 * 目的 / Purpose:
 * - エラー発生時に親ジョブのカウンターが更新されることを検証
 * - 正常処理時の動作を検証（EQUALステータス）
 * - publishModeの設定に応じてSYNC/ASYNCの正しいメソッドが呼ばれることを検証
 *
 * - Verify parent job counters are updated when errors occur
 * - Verify normal processing behavior (EQUAL status)
 * - Verify correct SYNC/ASYNC methods are called based on publishMode configuration
 */
import { createMock } from '@golevelup/ts-jest'
import { KEY_SEPARATOR } from '@mbc-cqrs-serverless/core'
import { Test, TestingModule } from '@nestjs/testing'

import { CSV_IMPORT_PK_PREFIX, IMPORT_PK_PREFIX } from '../constant'
import { ImportStatusEnum } from '../enum'
import { ComparisonStatus } from '../enum/comparison-status.enum'
import {
  PROCESS_STRATEGY_MAP,
  PUBLISH_MODE_MAP,
} from '../import.module-definition'
import { ImportService } from '../import.service'
import { IProcessStrategy } from '../interface/processing-strategy.interface'
import { ImportQueueEvent } from './import.queue.event'
import { ImportQueueEventHandler } from './import.queue.event.handler'

describe('ImportQueueEventHandler', () => {
  let handler: ImportQueueEventHandler
  let importService: jest.Mocked<ImportService>
  let mockStrategy: jest.Mocked<IProcessStrategy<any, any>>
  let strategyMap: Map<string, IProcessStrategy<any, any>>
  let publishModeMap: Map<string, 'SYNC' | 'ASYNC'>
  let mockCommandService: any

  const mockTenantCode = 'tenant001'
  const mockParentPk = `${CSV_IMPORT_PK_PREFIX}${KEY_SEPARATOR}${mockTenantCode}`
  const mockParentSk = 'building#01PARENT123'
  const mockChildPk = `${IMPORT_PK_PREFIX}${KEY_SEPARATOR}${mockTenantCode}`
  const mockChildSk = `${mockParentPk}${KEY_SEPARATOR}${mockParentSk}${KEY_SEPARATOR}01CHILD456`

  beforeEach(async () => {
    // Mock the CommandService with both Sync and Async methods
    mockCommandService = {
      publishAsync: jest.fn().mockResolvedValue({ id: 'async-result' }),
      publishSync: jest.fn().mockResolvedValue({ id: 'sync-result' }),
      publishPartialUpdateAsync: jest
        .fn()
        .mockResolvedValue({ id: 'async-partial-result' }),
      publishPartialUpdateSync: jest
        .fn()
        .mockResolvedValue({ id: 'sync-partial-result' }),
    }

    mockStrategy = {
      compare: jest.fn(),
      map: jest.fn().mockResolvedValue({ pk: 'test', sk: 'test' }),
      getCommandService: jest.fn().mockReturnValue(mockCommandService),
    } as any

    strategyMap = new Map()
    strategyMap.set('building', mockStrategy)

    // Setup the Publish Mode Map (Default to ASYNC for test isolation)
    publishModeMap = new Map()
    publishModeMap.set('building', 'ASYNC')

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
        {
          provide: PUBLISH_MODE_MAP,
          useValue: publishModeMap,
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
    it('should skip jobs that do not start with IMPORT prefix', async () => {
      const event = createMockEvent({
        pk: 'OTHER_PREFIX#tenant001',
        sk: mockChildSk,
        tableName: 'building',
      })

      await handler.execute(event)

      expect(importService.updateStatus).not.toHaveBeenCalled()
    })

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
          error: expect.stringContaining(
            'No import strategies registered for table: unknown_table',
          ),
        }),
      )
    })
  })

  describe('handleImport - error handling', () => {
    it('should call incrementParentJobCounters with false when error occurs', async () => {
      const event = createMockEvent({
        pk: mockChildPk,
        sk: mockChildSk,
        tableName: 'building',
      })

      const error = new Error('ConditionalCheckFailedException')
      mockStrategy.compare.mockRejectedValue(error)

      await handler.execute(event)

      expect(importService.incrementParentJobCounters).toHaveBeenCalledWith(
        { pk: mockParentPk, sk: mockParentSk },
        false,
      )
    })

    it('should not throw error after handling - prevents Lambda crash', async () => {
      const event = createMockEvent({
        pk: mockChildPk,
        sk: mockChildSk,
        tableName: 'building',
      })

      mockStrategy.compare.mockRejectedValue(new Error('Test error'))

      await expect(handler.execute(event)).resolves.not.toThrow()
    })

    it('should update child job status to FAILED when error occurs', async () => {
      const event = createMockEvent({
        pk: mockChildPk,
        sk: mockChildSk,
        tableName: 'building',
      })

      const error = new Error('Test error message')
      mockStrategy.compare.mockRejectedValue(error)

      await handler.execute(event)

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

  describe('handleImport - logic and routing paths', () => {
    it('should handle EQUAL status by marking completed and skipping publish', async () => {
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
        ImportStatusEnum.COMPLETED,
        expect.objectContaining({
          result: expect.objectContaining({ status: 'EQUAL' }),
        }),
      )
      expect(importService.incrementParentJobCounters).toHaveBeenCalledWith(
        { pk: mockParentPk, sk: mockParentSk },
        true,
      )
      expect(mockCommandService.publishAsync).not.toHaveBeenCalled()
      expect(mockCommandService.publishSync).not.toHaveBeenCalled()
    })

    // --- ASYNC ROUTING (Default) ---
    it('should call publishAsync when mode is ASYNC and status is NOT_EXIST', async () => {
      publishModeMap.set('building', 'ASYNC')

      const event = createMockEvent({
        pk: mockChildPk,
        sk: mockChildSk,
        tableName: 'building',
      })

      mockStrategy.compare.mockResolvedValue({
        status: ComparisonStatus.NOT_EXIST,
      })

      await handler.execute(event)

      expect(mockCommandService.publishAsync).toHaveBeenCalled()
      expect(mockCommandService.publishSync).not.toHaveBeenCalled()
      expect(importService.updateStatus).toHaveBeenCalledWith(
        { pk: mockChildPk, sk: mockChildSk },
        ImportStatusEnum.PROCESSING,
        expect.objectContaining({ result: { id: 'async-result' } }),
      )
    })

    it('should call publishPartialUpdateAsync when mode is ASYNC and status is CHANGED', async () => {
      publishModeMap.set('building', 'ASYNC')

      const event = createMockEvent({
        pk: mockChildPk,
        sk: mockChildSk,
        tableName: 'building',
      })

      mockStrategy.compare.mockResolvedValue({
        status: ComparisonStatus.CHANGED,
        existingData: { version: 1 },
      })

      await handler.execute(event)

      expect(mockCommandService.publishPartialUpdateAsync).toHaveBeenCalled()
      expect(mockCommandService.publishPartialUpdateSync).not.toHaveBeenCalled()
    })

    // --- SYNC ROUTING ---
    it('should call publishSync when mode is SYNC and status is NOT_EXIST', async () => {
      publishModeMap.set('building', 'SYNC') // Switch to SYNC

      const event = createMockEvent({
        pk: mockChildPk,
        sk: mockChildSk,
        tableName: 'building',
      })

      mockStrategy.compare.mockResolvedValue({
        status: ComparisonStatus.NOT_EXIST,
      })

      await handler.execute(event)

      expect(mockCommandService.publishSync).toHaveBeenCalled()
      expect(mockCommandService.publishAsync).not.toHaveBeenCalled()
      expect(importService.updateStatus).toHaveBeenCalledWith(
        { pk: mockChildPk, sk: mockChildSk },
        ImportStatusEnum.PROCESSING,
        expect.objectContaining({ result: { id: 'sync-result' } }),
      )
    })

    it('should call publishPartialUpdateSync when mode is SYNC and status is CHANGED', async () => {
      publishModeMap.set('building', 'SYNC') // Switch to SYNC

      const event = createMockEvent({
        pk: mockChildPk,
        sk: mockChildSk,
        tableName: 'building',
      })

      mockStrategy.compare.mockResolvedValue({
        status: ComparisonStatus.CHANGED,
        existingData: { version: 1 },
      })

      await handler.execute(event)

      expect(mockCommandService.publishPartialUpdateSync).toHaveBeenCalled()
      expect(
        mockCommandService.publishPartialUpdateAsync,
      ).not.toHaveBeenCalled()
    })

    // --- FALLBACK ROUTING ---
    it('should safely default to publishAsync when mode is not defined in the map', async () => {
      publishModeMap.delete('building') // Remove config entirely

      const event = createMockEvent({
        pk: mockChildPk,
        sk: mockChildSk,
        tableName: 'building',
      })

      mockStrategy.compare.mockResolvedValue({
        status: ComparisonStatus.NOT_EXIST,
      })

      await handler.execute(event)

      // Assert it fell back to ASYNC
      expect(mockCommandService.publishAsync).toHaveBeenCalled()
      expect(mockCommandService.publishSync).not.toHaveBeenCalled()
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
