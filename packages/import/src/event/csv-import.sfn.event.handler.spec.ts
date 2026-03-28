/**
 * CsvImportSfnEventHandler Unit Tests
 */
import { Test, TestingModule } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'
import { S3Service } from '@mbc-cqrs-serverless/core'
import { ConfigService } from '@nestjs/config'
import { Readable } from 'stream'

import { CsvImportSfnEventHandler } from './csv-import.sfn.event.handler'
import { ImportService } from '../import.service'
import { CsvImportSfnEvent } from './csv-import.sfn.event'
import { ImportStatusEnum } from '../enum'
import {
  IMPORT_STRATEGY_MAP,
  PROCESS_STRATEGY_MAP,
  PUBLISH_MODE_MAP,
} from '../import.module-definition'
import { IImportStrategy, IProcessStrategy } from '../interface'

/**
 * Helper: creates a Readable stream simulating CSV content
 */
function makeCsvStream(rows: string[]): Readable {
  const header = 'col1,col2'
  const content = [header, ...rows].join('\n')
  return Readable.from([content])
}

describe('CsvImportSfnEventHandler', () => {
  let handler: CsvImportSfnEventHandler
  let importService: jest.Mocked<ImportService>
  let s3Service: jest.Mocked<S3Service>

  const mockTenantCode = 'tenant001'
  const mockSourceId = `CSV_IMPORT#${mockTenantCode}#building#01PARENT123`
  const mockBucket = 'test-bucket'
  const mockKey = 'test.csv'

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CsvImportSfnEventHandler,
        {
          provide: ImportService,
          useValue: createMock<ImportService>(),
        },
        {
          provide: IMPORT_STRATEGY_MAP,
          useValue: new Map<string, IImportStrategy<any, any>>(),
        },
        {
          provide: PROCESS_STRATEGY_MAP,
          useValue: new Map<string, IProcessStrategy<any, any>>(),
        },
        {
          provide: PUBLISH_MODE_MAP,
          useValue: new Map(),
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('arn:aws:sns:test'),
          },
        },
        {
          provide: S3Service,
          useValue: createMock<S3Service>(),
        },
      ],
    }).compile()

    handler = module.get<CsvImportSfnEventHandler>(CsvImportSfnEventHandler)
    importService = module.get(ImportService) as jest.Mocked<ImportService>
    s3Service = module.get(S3Service) as jest.Mocked<S3Service>

    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(handler).toBeDefined()
  })

  describe('finalize_parent_job status determination', () => {
    it('should aggregate batch results and set COMPLETED status', async () => {
      // Arrange
      const mockEvent: CsvImportSfnEvent = {
        context: {
          State: { Name: 'finalize_parent_job' },
          Execution: {
            Input: { sourceId: mockSourceId },
          },
        },
        // Simulate output from Distributed Map
        input: {
          processingResults: [
            {
              totalRows: 1000,
              succeededRows: 1000,
              failedRows: 0,
            },
            {
              totalRows: 500,
              succeededRows: 500,
              failedRows: 0,
            },
          ],
        },
      } as any

      importService.updateStatus.mockResolvedValue(undefined)

      // Act
      await handler.execute(mockEvent)

      // Assert
      expect(importService.updateStatus).toHaveBeenCalledWith(
        { pk: `CSV_IMPORT#${mockTenantCode}`, sk: 'building#01PARENT123' },
        ImportStatusEnum.COMPLETED,
        expect.objectContaining({
          result: expect.objectContaining({
            total: 1500,
            succeeded: 1500,
            failed: 0,
          }),
        }),
      )
    })

    it('should aggregate batch results and set FAILED status if any row failed', async () => {
      // Arrange
      const mockEvent: CsvImportSfnEvent = {
        context: {
          State: { Name: 'finalize_parent_job' },
          Execution: {
            Input: { sourceId: mockSourceId },
          },
        },
        // Simulate output from Distributed Map with failures
        input: {
          processingResults: [
            {
              totalRows: 1000,
              succeededRows: 998,
              failedRows: 2,
            },
            {
              totalRows: 500,
              succeededRows: 500,
              failedRows: 0,
            },
          ],
        },
      } as any

      importService.updateStatus.mockResolvedValue(undefined)

      // Act
      await handler.execute(mockEvent)

      // Assert
      expect(importService.updateStatus).toHaveBeenCalledWith(
        { pk: `CSV_IMPORT#${mockTenantCode}`, sk: 'building#01PARENT123' },
        ImportStatusEnum.FAILED, // Status should be FAILED because failedRows > 0
        expect.objectContaining({
          result: expect.objectContaining({
            total: 1500,
            succeeded: 1498,
            failed: 2,
          }),
        }),
      )
    })

    it('should handle alternative local mock payload shape (nested array)', async () => {
      // Arrange - local mock wraps the output in an array
      const mockEvent: CsvImportSfnEvent = {
        context: {
          State: { Name: 'finalize_parent_job' },
          Execution: {
            Input: { sourceId: mockSourceId },
          },
        },
        input: [
          [
            {
              totalRows: 10,
              succeededRows: 10,
              failedRows: 0,
            },
          ],
        ],
      } as any

      importService.updateStatus.mockResolvedValue(undefined)

      // Act
      await handler.execute(mockEvent)

      // Assert
      expect(importService.updateStatus).toHaveBeenCalledWith(
        expect.any(Object),
        ImportStatusEnum.COMPLETED,
        expect.objectContaining({
          result: expect.objectContaining({
            total: 10,
          }),
        }),
      )
    })

    it('should mark FAILED when processingResults is empty', async () => {
      const mockEvent: CsvImportSfnEvent = {
        context: {
          State: { Name: 'finalize_parent_job' },
          Execution: {
            Input: { sourceId: mockSourceId },
          },
        },
        input: { processingResults: [] },
      } as any

      importService.updateStatus.mockResolvedValue(undefined)

      await handler.execute(mockEvent)

      expect(importService.updateStatus).toHaveBeenCalledWith(
        { pk: `CSV_IMPORT#${mockTenantCode}`, sk: 'building#01PARENT123' },
        ImportStatusEnum.FAILED,
        {
          result: { message: 'No batch processing results received.' },
        },
      )
    })
  })

  describe('csv_loader state', () => {
    it('should count rows and load first batch', async () => {
      // Arrange
      const mockEvent: CsvImportSfnEvent = {
        context: {
          State: { Name: 'csv_loader' },
        },
        input: {
          sourceId: mockSourceId,
          bucket: mockBucket,
          key: mockKey,
          tenantCode: mockTenantCode,
          tableName: 'building',
        },
      } as any

      // S3 streams for countCsvRows and loadCsv
      s3Service.client.send = jest
        .fn()
        .mockResolvedValueOnce({
          Body: makeCsvStream(['r1,v1', 'r2,v2', 'r3,v3']),
        })
        .mockResolvedValueOnce({
          Body: makeCsvStream(['r1,v1', 'r2,v2', 'r3,v3']),
        })

      importService.updateImportJob.mockResolvedValue({
        processedRows: 0,
        failedRows: 0,
        succeededRows: 0,
        totalRows: 3,
      } as any)

      // Act
      await handler.execute(mockEvent)

      // Assert
      expect(importService.updateImportJob).toHaveBeenCalledWith(
        { pk: `CSV_IMPORT#${mockTenantCode}`, sk: 'building#01PARENT123' },
        { set: { totalRows: 3 } },
      )
    })
  })
})
