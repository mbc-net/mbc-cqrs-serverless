import { createMock } from '@golevelup/ts-jest'
import { S3Service, SqsService } from '@mbc-cqrs-serverless/core'
import { ConfigService } from '@nestjs/config'
import { Test, TestingModule } from '@nestjs/testing'
import { Buffer } from 'buffer'
import { Readable } from 'stream'

import { ImportStatusEnum } from '../enum'
import { IMPORT_STRATEGY_MAP } from '../import.module-definition'
import { ImportService } from '../import.service'
import { IImportStrategy } from '../interface'
import { CsvImportSfnEvent } from './csv-import.sfn.event'
import { CsvImportSfnEventHandler } from './csv-import.sfn.event.handler'

// Helper: creates a Readable stream simulating S3 Buffer content (Required for Buffer.concat)
function makeStringStream(content: string): Readable {
  return Readable.from([Buffer.from(content, 'utf-8')])
}

describe('CsvImportSfnEventHandler', () => {
  let handler: CsvImportSfnEventHandler
  let importService: jest.Mocked<ImportService>
  let s3Service: jest.Mocked<S3Service>
  let sqsService: jest.Mocked<SqsService>
  let mockStrategy: jest.Mocked<IImportStrategy<any, any>>

  const mockTenantCode = 'tenant001'
  const mockSourceId = `CSV_IMPORT#${mockTenantCode}#building#01PARENT123`

  beforeEach(async () => {
    mockStrategy = {
      transform: jest.fn().mockImplementation((item) => Promise.resolve(item)),
      validate: jest.fn().mockResolvedValue(undefined),
    } as any

    const strategyMap = new Map<string, IImportStrategy<any, any>>()
    strategyMap.set('building', mockStrategy)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CsvImportSfnEventHandler,
        { provide: ImportService, useValue: createMock<ImportService>() },
        { provide: IMPORT_STRATEGY_MAP, useValue: strategyMap },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'IMPORT_QUEUE_URL') return 'https://sqs.test'
              return 'arn:aws:sns:test'
            }),
          },
        },
        { provide: S3Service, useValue: createMock<S3Service>() },
        { provide: SqsService, useValue: createMock<SqsService>() },
      ],
    }).compile()

    handler = module.get<CsvImportSfnEventHandler>(CsvImportSfnEventHandler)
    importService = module.get(ImportService) as jest.Mocked<ImportService>
    s3Service = module.get(S3Service) as jest.Mocked<S3Service>
    sqsService = module.get(SqsService) as jest.Mocked<SqsService>

    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(handler).toBeDefined()
  })

  describe('finalize_parent_job fail-safes (States.ALL)', () => {
    it('should handle Empty CSV headers error gracefully (Mark COMPLETED)', async () => {
      const mockEvent: CsvImportSfnEvent = {
        context: {
          State: { Name: 'finalize_parent_job' },
          Execution: { Input: { sourceId: mockSourceId } },
        },
        input: {
          errorOutput: {
            Error: 'States.ItemReaderFailed',
            Cause: 'Input data cannot be only CSV headers',
          },
        },
      } as any

      await handler.execute(mockEvent)

      expect(importService.updateStatus).toHaveBeenCalledWith(
        expect.any(Object),
        ImportStatusEnum.COMPLETED,
        expect.objectContaining({
          result: expect.objectContaining({
            message: expect.stringContaining('contains only headers'),
            total: 0,
          }),
        }),
      )
    })

    it('should handle general Map State crashes and abort gracefully (Mark FAILED)', async () => {
      const mockEvent: CsvImportSfnEvent = {
        context: {
          State: { Name: 'finalize_parent_job' },
          Execution: { Input: { sourceId: mockSourceId } },
        },
        input: {
          errorOutput: { Error: 'States.TaskFailed', Cause: 'Lambda timeout' },
        },
      } as any

      await handler.execute(mockEvent)

      expect(importService.updateStatus).toHaveBeenCalledWith(
        expect.any(Object),
        ImportStatusEnum.FAILED,
        expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringContaining('States.TaskFailed'),
          }),
        }),
      )
    })
  })

  describe('finalize_parent_job success flow (S3 ResultWriter)', () => {
    it('should stream both SUCCEEDED and FAILED results from S3 and aggregate accurately', async () => {
      const mockEvent: CsvImportSfnEvent = {
        context: { State: { Name: 'finalize_parent_job' }, Execution: { Input: { sourceId: mockSourceId } } },
        input: {
          mapOutput: {
            ResultWriterDetails: { Bucket: 'res-bucket', Key: 'import-results/123/manifest.json' },
          },
        },
      } as any

      // THE FIX: Mock manifest to include a FAILED file
      const manifestContent = JSON.stringify({
        ResultFiles: { 
          SUCCEEDED: [{ Key: 'import-results/123/SUCCEEDED_0.json' }],
          FAILED: [{ Key: 'import-results/123/FAILED_0.json' }]
        },
      })
      
      const successFileContent = JSON.stringify([
        { Output: "{\"totalRows\":100,\"succeededRows\":100,\"failedRows\":0}" },
        { Output: "{\"totalRows\":50,\"succeededRows\":48,\"failedRows\":2}" }
      ])

      // THE FIX: Mock what Step Functions outputs when a Map iteration crashes
      const failedFileContent = JSON.stringify([
        { 
          Error: "States.Timeout", 
          Cause: "Lambda timed out", 
          Input: "{\"Items\":[1, 2, 3, 4, 5]}" // 5 rows lost in this crash
        }
      ])

      jest.spyOn(s3Service.client, 'send')
        .mockResolvedValueOnce({ Body: makeStringStream(manifestContent) } as never)
        .mockResolvedValueOnce({ Body: makeStringStream(successFileContent) } as never)
        .mockResolvedValueOnce({ Body: makeStringStream(failedFileContent) } as never) // Add 3rd mock response

      await handler.execute(mockEvent)

      // Expected calculation: 
      // Total rows: 100 + 50 + 5 (from crash) = 155
      // Succeeded: 100 + 48 + 0 = 148
      // Failed: 0 + 2 + 5 (from crash) = 7
      expect(importService.updateStatus).toHaveBeenCalledWith(
        expect.any(Object),
        ImportStatusEnum.FAILED, 
        expect.objectContaining({
          result: expect.objectContaining({ total: 155, succeeded: 148, failed: 7 }),
        }),
      )
    })
  })

  describe('Row Packer & SQS Delegator (Default Map State)', () => {
    it('should transform, validate, and pack rows into an SQS batch safely', async () => {
      const mockEvent: CsvImportSfnEvent = {
        context: { State: { Name: 'csv_rows_handler' } },
        input: {
          BatchInput: {
            Attributes: {
              tableName: 'building',
              tenantCode: 'tenant001',
              key: 's3.csv',
            },
          },
          Items: [{ data: 'A' }, { data: 'B' }],
        },
      } as any

      // SAFE MOCKING: Use jest.spyOn
      jest.spyOn(sqsService, 'sendMessageBatch').mockImplementation(
        async (url, batch) =>
          ({
            $metadata: { httpStatusCode: 200 },
            Successful: batch.map((b) => ({
              Id: b.Id,
              MessageId: 'mock-msg',
              MD5OfMessageBody: 'md5',
            })),
            Failed: [],
          }) as any,
      )

      const result = await handler.execute(mockEvent)

      expect(mockStrategy.transform).toHaveBeenCalledTimes(2)
      expect(mockStrategy.validate).toHaveBeenCalledTimes(2)
      expect(sqsService.sendMessageBatch).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ totalRows: 2, succeededRows: 2, failedRows: 0 })
    })

    it('should count validation errors as failedRows and not send them to SQS', async () => {
      const mockEvent: CsvImportSfnEvent = {
        context: { State: { Name: 'csv_rows_handler' } },
        input: {
          BatchInput: {
            Attributes: {
              tableName: 'building',
              tenantCode: 'tenant001',
              key: 's3.csv',
            },
          },
          Items: [{ data: 'Good' }, { data: 'Bad' }],
        },
      } as any

      mockStrategy.validate
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Validation failed'))

      jest.spyOn(sqsService, 'sendMessageBatch').mockImplementation(
        async (url, batch) =>
          ({
            $metadata: { httpStatusCode: 200 },
            Successful: batch.map((b) => ({
              Id: b.Id,
              MessageId: 'mock',
              MD5OfMessageBody: 'md5',
            })),
            Failed: [],
          }) as any,
      )

      const result = await handler.execute(mockEvent)

      expect(mockStrategy.transform).toHaveBeenCalledTimes(2)
      expect(sqsService.sendMessageBatch).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ totalRows: 2, succeededRows: 1, failedRows: 1 })
    })
  })
})
