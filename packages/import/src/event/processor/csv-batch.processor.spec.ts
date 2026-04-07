import { createMock } from '@golevelup/ts-jest'
import { CommandService } from '@mbc-cqrs-serverless/core'
import { Test, TestingModule } from '@nestjs/testing'

import { ImportPublishMode } from '../../constant'
import { SqsBatchPayload } from '../../constant/sqs.constant'
import { ComparisonStatus } from '../../enum/comparison-status.enum'
import {
  PROCESS_STRATEGY_MAP,
  PUBLISH_MODE_MAP,
} from '../../import.module-definition'
import { IProcessStrategy } from '../../interface/processing-strategy.interface'
import { CsvBatchProcessor } from './csv-batch.processor'

describe('CsvBatchProcessor', () => {
  let processor: CsvBatchProcessor
  let mockStrategy: jest.Mocked<IProcessStrategy<any, any>>
  let mockCommandService: jest.Mocked<CommandService>
  let strategyMap: Map<string, IProcessStrategy<any, any>>
  let publishModeMap: Map<string, ImportPublishMode>

  const mockPayload: SqsBatchPayload = {
    action: 'csv-batch-process',
    tableName: 'contract',
    tenantCode: 'tenant001',
    sourceId: 'SOURCE#123',
    s3Key: 'path/to/file.csv',
    items: [
      { id: '1', value: 'A' },
      { id: '2', value: 'B' },
    ],
  }

  beforeEach(async () => {
    mockCommandService = createMock<CommandService>()

    mockStrategy = {
      compare: jest.fn(),
      map: jest.fn().mockResolvedValue({ pk: 'PK', sk: 'SK' }),
      getCommandService: jest.fn().mockReturnValue(mockCommandService),
    } as any

    strategyMap = new Map()
    strategyMap.set('contract', mockStrategy)

    publishModeMap = new Map()
    publishModeMap.set('contract', ImportPublishMode.ASYNC)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CsvBatchProcessor,
        { provide: PROCESS_STRATEGY_MAP, useValue: strategyMap },
        { provide: PUBLISH_MODE_MAP, useValue: publishModeMap },
      ],
    }).compile()

    processor = module.get<CsvBatchProcessor>(CsvBatchProcessor)
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(processor).toBeDefined()
  })

  it('should throw an error if no strategy is found for the table', async () => {
    const invalidPayload = { ...mockPayload, tableName: 'unknown_table' }
    await expect(processor.process(invalidPayload)).rejects.toThrow(
      'No process strategy registered for table: unknown_table',
    )
  })

  it('should skip processing for items that are EQUAL', async () => {
    mockStrategy.compare.mockResolvedValue({ status: ComparisonStatus.EQUAL })

    await processor.process(mockPayload)

    expect(mockStrategy.compare).toHaveBeenCalledTimes(2)
    expect(mockStrategy.map).not.toHaveBeenCalled()
    expect(mockCommandService.publishAsync).not.toHaveBeenCalled()
  })

  describe('ASYNC Publish Mode (Default)', () => {
    it('should call publishAsync when status is NOT_EXIST', async () => {
      mockStrategy.compare.mockResolvedValue({
        status: ComparisonStatus.NOT_EXIST,
      })

      await processor.process({ ...mockPayload, items: [{ id: '1' }] })

      expect(mockStrategy.map).toHaveBeenCalledWith(
        ComparisonStatus.NOT_EXIST,
        { id: '1' },
        'tenant001',
        undefined,
      )
      expect(mockCommandService.publishAsync).toHaveBeenCalled()
      expect(mockCommandService.publishSync).not.toHaveBeenCalled()
    })

    it('should call publishPartialUpdateAsync when status is CHANGED', async () => {
      const existingData = { id: '1', old: 'value' }
      mockStrategy.compare.mockResolvedValue({
        status: ComparisonStatus.CHANGED,
        existingData,
      })

      await processor.process({ ...mockPayload, items: [{ id: '1' }] })

      expect(mockStrategy.map).toHaveBeenCalledWith(
        ComparisonStatus.CHANGED,
        { id: '1' },
        'tenant001',
        existingData,
      )
      expect(mockCommandService.publishPartialUpdateAsync).toHaveBeenCalled()
      expect(mockCommandService.publishPartialUpdateSync).not.toHaveBeenCalled()
    })
  })

  describe('SYNC Publish Mode', () => {
    beforeEach(() => {
      publishModeMap.set('contract', ImportPublishMode.SYNC)
    })

    it('should call publishSync when status is NOT_EXIST', async () => {
      mockStrategy.compare.mockResolvedValue({
        status: ComparisonStatus.NOT_EXIST,
      })

      await processor.process({ ...mockPayload, items: [{ id: '1' }] })

      expect(mockCommandService.publishSync).toHaveBeenCalled()
      expect(mockCommandService.publishAsync).not.toHaveBeenCalled()
    })

    it('should call publishPartialUpdateSync when status is CHANGED', async () => {
      mockStrategy.compare.mockResolvedValue({
        status: ComparisonStatus.CHANGED,
      })

      await processor.process({ ...mockPayload, items: [{ id: '1' }] })

      expect(mockCommandService.publishPartialUpdateSync).toHaveBeenCalled()
      expect(
        mockCommandService.publishPartialUpdateAsync,
      ).not.toHaveBeenCalled()
    })
  })
})
