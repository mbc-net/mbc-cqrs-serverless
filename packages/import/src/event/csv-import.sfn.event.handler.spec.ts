/**
 * CsvImportSfnEventHandler Unit Tests
 *
 * 概要 / Overview:
 * CsvImportSfnEventHandlerのユニットテストスイート。Step Functions経由の
 * CSVインポート処理とステータス決定ロジックを検証します。
 *
 * Unit test suite for CsvImportSfnEventHandler. Verifies CSV import
 * processing via Step Functions and status determination logic.
 *
 * 目的 / Purpose:
 * - finalizeParentJobで子ジョブ失敗時にFAILEDステータスが設定されることを検証
 * - csv_loaderで子ジョブ失敗時にFAILEDステータスが設定されることを検証
 * - 正常処理時はCOMPLETEDステータスが設定されることを検証
 *
 * - Verify FAILED status is set when child jobs fail in finalizeParentJob
 * - Verify FAILED status is set when child jobs fail in csv_loader
 * - Verify COMPLETED status is set on successful processing
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
import { IMPORT_STRATEGY_MAP } from '../import.module-definition'
import { IImportStrategy } from '../interface'

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
  let strategyMap: Map<string, IImportStrategy<any, any>>

  const mockTenantCode = 'tenant001'
  const mockSourceId = `CSV_IMPORT#${mockTenantCode}#building#01PARENT123`
  const mockBucket = 'test-bucket'
  const mockKey = 'test.csv'

  beforeEach(async () => {
    strategyMap = new Map()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CsvImportSfnEventHandler,
        {
          provide: ImportService,
          useValue: createMock<ImportService>(),
        },
        {
          provide: IMPORT_STRATEGY_MAP,
          useValue: strategyMap,
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

  /**
   * finalize_parent_job ステータス決定ロジックのテスト
   * Tests for finalize_parent_job status determination logic
   *
   * FIX: MapResult.length の代わりに countCsvRows() で totalRows を取得するように変更
   * FIX: totalRows is now derived from countCsvRows() instead of MapResult.length
   */
  describe('finalize_parent_job status determination', () => {
    /**
     * テスト: 子ジョブが失敗した場合はFAILEDステータスを設定する
     * Test: Should set FAILED status when child jobs have failed
     */
    it('should set FAILED status when failedRows > 0', async () => {
      // Arrange
      // FIX: input はもう MapResult を含まない。bucket/key が必須。
      // FIX: input no longer contains MapResult. bucket/key are required.
      const mockEvent: CsvImportSfnEvent = {
        context: {
          State: { Name: 'finalize_parent_job' },
        },
        input: {
          sourceId: mockSourceId,
          bucket: mockBucket,
          key: mockKey,
          tenantCode: mockTenantCode,
          tableName: 'building',
        },
      } as any

      // FIX: S3からCSVを読み込んでrow数を返すモック (1 row → totalRows=1)
      // FIX: mock S3 to return a CSV stream with 1 data row → totalRows=1
      s3Service.client.send = jest.fn().mockResolvedValue({
        Body: makeCsvStream(['val1,val2']),
      })

      importService.updateImportJob.mockResolvedValue({
        processedRows: 1,
        failedRows: 1,
        succeededRows: 0,
        totalRows: 1,
      } as any)

      importService.updateStatus.mockResolvedValue(undefined)

      // Act
      await handler.execute(mockEvent)

      // Assert
      expect(importService.updateImportJob).toHaveBeenCalledWith(
        expect.objectContaining({
          pk: `CSV_IMPORT#${mockTenantCode}`,
          sk: 'building#01PARENT123',
        }),
        { set: { totalRows: 1 } }, // FIX: totalRows từ countCsvRows, không phải MapResult.length
      )
      expect(importService.updateStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          pk: `CSV_IMPORT#${mockTenantCode}`,
          sk: 'building#01PARENT123',
        }),
        ImportStatusEnum.FAILED,
        expect.objectContaining({
          result: expect.objectContaining({
            failed: 1,
            succeeded: 0,
          }),
        }),
      )
    })

    /**
     * テスト: 全ての子ジョブが成功した場合はCOMPLETEDステータスを設定する
     * Test: Should set COMPLETED status when all child jobs succeeded
     */
    it('should set COMPLETED status when failedRows = 0', async () => {
      // Arrange
      const mockEvent: CsvImportSfnEvent = {
        context: {
          State: { Name: 'finalize_parent_job' },
        },
        input: {
          sourceId: mockSourceId,
          bucket: mockBucket,
          key: mockKey,
          tenantCode: mockTenantCode,
          tableName: 'building',
        },
      } as any

      // FIX: 2 data rows → totalRows=2
      s3Service.client.send = jest.fn().mockResolvedValue({
        Body: makeCsvStream(['val1,val2', 'val3,val4']),
      })

      importService.updateImportJob.mockResolvedValue({
        processedRows: 2,
        failedRows: 0,
        succeededRows: 2,
        totalRows: 2,
      } as any)

      importService.updateStatus.mockResolvedValue(undefined)

      // Act
      await handler.execute(mockEvent)

      // Assert
      expect(importService.updateImportJob).toHaveBeenCalledWith(
        expect.any(Object),
        { set: { totalRows: 2 } },
      )
      expect(importService.updateStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          pk: `CSV_IMPORT#${mockTenantCode}`,
          sk: 'building#01PARENT123',
        }),
        ImportStatusEnum.COMPLETED,
        expect.objectContaining({
          result: expect.objectContaining({
            failed: 0,
            succeeded: 2,
          }),
        }),
      )
    })

    /**
     * テスト: 一部の子ジョブが失敗した場合はFAILEDステータスを設定する
     * Test: Should set FAILED status when some child jobs failed
     */
    it('should set FAILED status when some child jobs failed', async () => {
      // Arrange
      const mockEvent: CsvImportSfnEvent = {
        context: {
          State: { Name: 'finalize_parent_job' },
        },
        input: {
          sourceId: mockSourceId,
          bucket: mockBucket,
          key: mockKey,
          tenantCode: mockTenantCode,
          tableName: 'building',
        },
      } as any

      // FIX: 3 data rows → totalRows=3
      s3Service.client.send = jest.fn().mockResolvedValue({
        Body: makeCsvStream(['r1c1,r1c2', 'r2c1,r2c2', 'r3c1,r3c2']),
      })

      importService.updateImportJob.mockResolvedValue({
        processedRows: 3,
        failedRows: 1,
        succeededRows: 2,
        totalRows: 3,
      } as any)

      importService.updateStatus.mockResolvedValue(undefined)

      // Act
      await handler.execute(mockEvent)

      // Assert
      expect(importService.updateImportJob).toHaveBeenCalledWith(
        expect.any(Object),
        { set: { totalRows: 3 } },
      )
      expect(importService.updateStatus).toHaveBeenCalledWith(
        expect.any(Object),
        ImportStatusEnum.FAILED,
        expect.any(Object),
      )
    })

    /**
     * テスト: processedRows < totalRows の場合はステータスを更新しない
     * Test: Should NOT update status when processing is not yet complete
     */
    it('should NOT call updateStatus when processedRows < totalRows', async () => {
      // Arrange — CSV has 5 rows but only 3 processed so far
      const mockEvent: CsvImportSfnEvent = {
        context: {
          State: { Name: 'finalize_parent_job' },
        },
        input: {
          sourceId: mockSourceId,
          bucket: mockBucket,
          key: mockKey,
          tenantCode: mockTenantCode,
          tableName: 'building',
        },
      } as any

      s3Service.client.send = jest.fn().mockResolvedValue({
        Body: makeCsvStream(['r1,v1', 'r2,v2', 'r3,v3', 'r4,v4', 'r5,v5']),
      })

      importService.updateImportJob.mockResolvedValue({
        processedRows: 3,
        failedRows: 0,
        succeededRows: 3,
        totalRows: 5,
      } as any)

      // Act
      await handler.execute(mockEvent)

      // Assert
      expect(importService.updateImportJob).toHaveBeenCalledWith(
        expect.any(Object),
        { set: { totalRows: 5 } },
      )
      expect(importService.updateStatus).not.toHaveBeenCalled()
    })

    /**
     * テスト: S3ストリームが取得できない場合はエラーをスローする
     * Test: Should throw error when S3 stream is not readable
     */
    it('should throw error when S3 Body is not a Readable stream', async () => {
      // Arrange
      const mockEvent: CsvImportSfnEvent = {
        context: {
          State: { Name: 'finalize_parent_job' },
        },
        input: {
          sourceId: mockSourceId,
          bucket: mockBucket,
          key: mockKey,
          tenantCode: mockTenantCode,
          tableName: 'building',
        },
      } as any

      s3Service.client.send = jest.fn().mockResolvedValue({
        Body: null, // not a Readable
      })

      // Act & Assert
      await expect(handler.execute(mockEvent)).rejects.toThrow(
        'Failed to get a readable stream from S3 object.',
      )
    })
  })

  /**
   * csv_loader ステータス決定ロジックのテスト（既に処理済みの場合）
   * Tests for csv_loader status determination logic (when already processed)
   */
  describe('csv_loader early finalization status determination', () => {
    /**
     * テスト: csv_loaderで既に処理済みで失敗がある場合はFAILEDを設定
     * Test: Should set FAILED in csv_loader when already processed with failures
     */
    it('should set FAILED status in csv_loader when processedRows >= totalRows and failedRows > 0', async () => {
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

      // countCsvRows call → 5 rows
      // loadCsv call → also reads from S3 (limit=10, returns items)
      s3Service.client.send = jest
        .fn()
        .mockResolvedValueOnce({
          Body: makeCsvStream(['r1,v1', 'r2,v2', 'r3,v3', 'r4,v4', 'r5,v5']),
        }) // first call: countCsvRows
        .mockResolvedValueOnce({
          Body: makeCsvStream(['r1,v1', 'r2,v2', 'r3,v3', 'r4,v4', 'r5,v5']),
        }) // second call: loadCsv

      importService.updateImportJob.mockResolvedValue({
        processedRows: 5,
        failedRows: 2,
        succeededRows: 3,
        totalRows: 5,
      } as any)

      importService.updateStatus.mockResolvedValue(undefined)

      // Act
      await handler.execute(mockEvent)

      // Assert
      expect(importService.updateImportJob).toHaveBeenCalledWith(
        expect.objectContaining({
          pk: `CSV_IMPORT#${mockTenantCode}`,
          sk: 'building#01PARENT123',
        }),
        { set: { totalRows: 5 } },
      )
      expect(importService.updateStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          pk: `CSV_IMPORT#${mockTenantCode}`,
          sk: 'building#01PARENT123',
        }),
        ImportStatusEnum.FAILED,
      )
    })
  })
})
