import { createMock } from '@golevelup/ts-jest'
import { CommandService, KEY_SEPARATOR } from '@mbc-cqrs-serverless/core'
import { Test, TestingModule } from '@nestjs/testing'

import {
  CSV_IMPORT_PK_PREFIX,
  IMPORT_PK_PREFIX,
  ImportPublishMode,
} from '../../constant'
import { ComparisonStatus } from '../../enum/comparison-status.enum'
import { ImportStatusEnum } from '../../enum/import-status.enum'
import {
  PROCESS_STRATEGY_MAP,
  PUBLISH_MODE_MAP,
} from '../../import.module-definition'
import { ImportService } from '../../import.service'
import { IProcessStrategy } from '../../interface/processing-strategy.interface'
import { SingleImportProcessor } from './single-import.processor'

describe('SingleImportProcessor', () => {
  let processor: SingleImportProcessor
  let importService: jest.Mocked<ImportService>
  let mockStrategy: jest.Mocked<IProcessStrategy<any, any>>
  let mockCommandService: jest.Mocked<CommandService>
  let strategyMap: Map<string, IProcessStrategy<any, any>>
  let publishModeMap: Map<string, ImportPublishMode>

  const mockTenantCode = 'tenant001'
  const mockTableName = 'contract'

  // Setup a mock payload where the parent is a CSV_IMPORT job
  const mockParentPk = `${CSV_IMPORT_PK_PREFIX}${KEY_SEPARATOR}${mockTenantCode}`
  const mockParentSk = 'contract#01PARENT123'
  const mockChildPk = `${IMPORT_PK_PREFIX}${KEY_SEPARATOR}${mockTenantCode}`
  const mockChildSk = `${mockParentPk}${KEY_SEPARATOR}${mockParentSk}${KEY_SEPARATOR}01CHILD456`

  const mockPayload = {
    importKey: { pk: mockChildPk, sk: mockChildSk },
    importEntity: {
      id: `${mockChildPk}${KEY_SEPARATOR}${mockChildSk}`,
      pk: mockChildPk,
      sk: mockChildSk,
      tenantCode: mockTenantCode,
      type: mockTableName,
      attributes: { code: 'test-code', name: 'Test Item' },
    },
  }

  beforeEach(async () => {
    importService = createMock<ImportService>()
    mockCommandService = createMock<CommandService>()

    mockStrategy = {
      compare: jest.fn(),
      map: jest.fn().mockResolvedValue({ pk: 'PK', sk: 'SK' }),
      getCommandService: jest.fn().mockReturnValue(mockCommandService),
    } as any

    strategyMap = new Map()
    strategyMap.set(mockTableName, mockStrategy)

    publishModeMap = new Map()
    publishModeMap.set(mockTableName, ImportPublishMode.ASYNC)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SingleImportProcessor,
        { provide: ImportService, useValue: importService },
        { provide: PROCESS_STRATEGY_MAP, useValue: strategyMap },
        { provide: PUBLISH_MODE_MAP, useValue: publishModeMap },
      ],
    }).compile()

    processor = module.get<SingleImportProcessor>(SingleImportProcessor)
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(processor).toBeDefined()
  })

  it('should skip processing if the entity ID does not start with IMPORT prefix', async () => {
    const invalidPayload = {
      ...mockPayload,
      importEntity: { ...mockPayload.importEntity, id: 'OTHER_PREFIX#123' },
    }

    await processor.process(invalidPayload)

    expect(importService.updateStatus).not.toHaveBeenCalled()
    expect(mockStrategy.compare).not.toHaveBeenCalled()
  })

  it('should mark job as FAILED and abort if no strategy is found for the table', async () => {
    const invalidPayload = {
      ...mockPayload,
      importEntity: { ...mockPayload.importEntity, type: 'unknown_table' },
    }

    await processor.process(invalidPayload)

    expect(importService.updateStatus).toHaveBeenCalledWith(
      invalidPayload.importKey,
      ImportStatusEnum.FAILED,
      expect.objectContaining({
        error: expect.stringContaining(
          'No import strategies registered for table: unknown_table',
        ),
      }),
    )
    expect(mockStrategy.compare).not.toHaveBeenCalled()
  })

  describe('Successful Strategy Execution', () => {
    it('should handle EQUAL status by marking completed and incrementing parent success', async () => {
      mockStrategy.compare.mockResolvedValue({ status: ComparisonStatus.EQUAL })

      await processor.process(mockPayload)

      expect(importService.updateStatus).toHaveBeenCalledWith(
        mockPayload.importKey,
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
    })

    describe('ASYNC Mode', () => {
      it('should map and publishAsync when status is NOT_EXIST', async () => {
        mockStrategy.compare.mockResolvedValue({
          status: ComparisonStatus.NOT_EXIST,
        })
        mockCommandService.publishAsync.mockResolvedValue({
          id: 'async-result',
        } as any)

        await processor.process(mockPayload)

        expect(mockCommandService.publishAsync).toHaveBeenCalled()
        expect(importService.updateStatus).toHaveBeenCalledWith(
          mockPayload.importKey,
          ImportStatusEnum.COMPLETED,
          { result: { id: 'async-result' } },
        )
      })

      it('should map and publishPartialUpdateAsync when status is CHANGED', async () => {
        mockStrategy.compare.mockResolvedValue({ status: ComparisonStatus.CHANGED, existingData: {} })
        mockCommandService.publishPartialUpdateAsync.mockResolvedValue({ id: 'async-partial' } as any)

        await processor.process(mockPayload)

        expect(mockCommandService.publishPartialUpdateAsync).toHaveBeenCalled()
        expect(importService.incrementParentJobCounters).toHaveBeenCalledWith(
          { pk: mockParentPk, sk: mockParentSk },
          true,
        )
      })
    })

    describe('SYNC Mode', () => {
      beforeEach(() => {
        publishModeMap.set(mockTableName, ImportPublishMode.SYNC)
      })

      it('should map and publishSync when status is NOT_EXIST', async () => {
        mockStrategy.compare.mockResolvedValue({ status: ComparisonStatus.NOT_EXIST })
        
        await processor.process(mockPayload)

        expect(mockCommandService.publishSync).toHaveBeenCalled()
        expect(mockCommandService.publishAsync).not.toHaveBeenCalled()
        
        expect(importService.updateStatus).toHaveBeenCalledWith(
          mockPayload.importKey,
          ImportStatusEnum.COMPLETED,
          expect.anything()
        )
        expect(importService.incrementParentJobCounters).toHaveBeenCalledWith(
          { pk: mockParentPk, sk: mockParentSk },
          true,
        )
      })
    })
  })

  describe('Error Handling', () => {
    it('should catch errors, update status to FAILED, publish alarm, and increment parent failure', async () => {
      const error = new Error('Database connection failed')
      mockStrategy.compare.mockRejectedValue(error)

      await processor.process(mockPayload)

      // 1. Should update child job to FAILED
      expect(importService.updateStatus).toHaveBeenCalledWith(
        mockPayload.importKey,
        ImportStatusEnum.FAILED,
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Database connection failed',
          }),
        }),
      )

      // 2. Should trigger an SNS alarm
      expect(importService.publishAlarm).toHaveBeenCalledWith(
        mockPayload,
        error.stack,
      )

      // 3. Should inform the parent CSV job that this row failed
      expect(importService.incrementParentJobCounters).toHaveBeenCalledWith(
        { pk: mockParentPk, sk: mockParentSk },
        false,
      )
    })
  })
})
