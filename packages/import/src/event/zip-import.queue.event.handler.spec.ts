import { createMock } from '@golevelup/ts-jest'
import {
  StepFunctionService,
  S3Service,
  KEY_SEPARATOR,
} from '@mbc-cqrs-serverless/core'
import { ConfigService } from '@nestjs/config'
import { Test, TestingModule } from '@nestjs/testing'
import { Readable } from 'stream'

import { ZIP_IMPORT_PK_PREFIX } from '../constant'
import { ImportStatusEnum } from '../enum/import-status.enum'
import { ImportService } from '../import.service'
import { ZipImportQueueEventHandler } from './zip-import.queue.event.handler'
import { ImportQueueEvent } from './import.queue.event'

// 1. Mock the AWS Upload library
jest.mock('@aws-sdk/lib-storage', () => ({
  Upload: jest.fn().mockImplementation(() => ({
    done: jest.fn().mockResolvedValue({ Location: 'mock-s3-location' }),
  })),
}))

// 2. Mock JSZip to simulate extracting a ZIP file
jest.mock('jszip', () => ({
  loadAsync: jest.fn().mockResolvedValue({
    files: {
      'file1.csv': {
        dir: false,
        name: 'file1.csv',
        async: jest.fn().mockResolvedValue(Buffer.from('data1')),
      },
      'file2.csv': {
        dir: false,
        name: 'file2.csv',
        async: jest.fn().mockResolvedValue(Buffer.from('data2')),
      },
      'ignore-me/': { dir: true, name: 'ignore-me/' }, // Directories should be ignored
    },
  }),
}))

function makeMockStream(): Readable {
  return Readable.from([Buffer.from('mock-zip-data')])
}

describe('ZipImportQueueEventHandler', () => {
  let handler: ZipImportQueueEventHandler
  let importService: jest.Mocked<ImportService>
  let sfnService: jest.Mocked<StepFunctionService>
  let s3Service: jest.Mocked<S3Service>
  let configService: jest.Mocked<ConfigService>

  const mockTenantCode = 'tenant001'
  const mockImportKey = {
    pk: `${ZIP_IMPORT_PK_PREFIX}${KEY_SEPARATOR}${mockTenantCode}`,
    sk: `ZIP#123`,
  }

  const mockImportEntity = {
    id: `${mockImportKey.pk}${KEY_SEPARATOR}${mockImportKey.sk}`,
    attributes: {
      bucket: 'test-bucket',
      key: 's3-key.zip',
      tableName: 'building',
      tenantCode: mockTenantCode,
    },
  }

  beforeEach(async () => {
    importService = createMock<ImportService>()
    sfnService = createMock<StepFunctionService>()
    s3Service = createMock<S3Service>()
    configService = createMock<ConfigService>()

    configService.get.mockImplementation((key: string) => {
      if (key === 'SFN_IMPORT_ZIP_ORCHESTRATOR_ARN')
        return 'arn:aws:states:test:zip-import-sfn'
      return null
    })

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZipImportQueueEventHandler,
        { provide: ImportService, useValue: importService },
        { provide: StepFunctionService, useValue: sfnService },
        { provide: S3Service, useValue: s3Service },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile()

    handler = module.get<ZipImportQueueEventHandler>(ZipImportQueueEventHandler)
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(handler).toBeDefined()
  })

  // ----------------------------------------------------------------
  // GUARD CLAUSE TESTS
  // ----------------------------------------------------------------
  it('should skip processing if event is a high-speed CSV batch', async () => {
    const mockEvent = { isCsvBatch: true } as unknown as ImportQueueEvent
    await handler.execute(mockEvent)
    expect(importService.updateStatus).not.toHaveBeenCalled()
  })

  it('should skip processing if prefix is not ZIP_IMPORT', async () => {
    const mockEvent = {
      isCsvBatch: false,
      importEvent: {
        importEntity: {
          ...mockImportEntity,
          id: `CSV_IMPORT#${mockTenantCode}#123`,
        },
      },
    } as unknown as ImportQueueEvent

    await handler.execute(mockEvent)
    expect(importService.updateStatus).not.toHaveBeenCalled()
  })

  // ----------------------------------------------------------------
  // SUCCESS / ERROR FLOWS
  // ----------------------------------------------------------------
  it('should start SFN immediately if sortedFileKeys are already provided', async () => {
    const mockEvent = {
      isCsvBatch: false,
      importEvent: {
        importEntity: {
          ...mockImportEntity,
          attributes: {
            ...mockImportEntity.attributes,
            sortedFileKeys: ['fileA.csv', 'fileB.csv'],
          },
        },
        importKey: mockImportKey,
      },
    } as unknown as ImportQueueEvent

    await handler.execute(mockEvent)

    expect(importService.updateStatus).toHaveBeenCalledWith(
      mockImportKey,
      ImportStatusEnum.PROCESSING,
      expect.any(Object),
    )
    expect(sfnService.startExecution).toHaveBeenCalledWith(
      'arn:aws:states:test:zip-import-sfn',
      expect.objectContaining({ sortedS3Keys: ['fileA.csv', 'fileB.csv'] }),
      expect.stringContaining(`${mockTenantCode}-zip-import-`),
    )
    expect(s3Service.client.send).not.toHaveBeenCalled() // No download needed
  })

  it('should throw an error if sortedFileKeys is provided but empty', async () => {
    const mockEvent = {
      isCsvBatch: false,
      importEvent: {
        importEntity: {
          ...mockImportEntity,
          attributes: { ...mockImportEntity.attributes, sortedFileKeys: [] },
        },
        importKey: mockImportKey,
      },
    } as unknown as ImportQueueEvent

    await expect(handler.execute(mockEvent)).rejects.toThrow(
      'Sorted file keys are required.',
    )

    expect(importService.updateStatus).toHaveBeenCalledWith(
      mockImportKey,
      ImportStatusEnum.FAILED,
      expect.objectContaining({
        error: expect.objectContaining({
          message: expect.stringContaining('Sorted file keys are required'),
        }),
      }),
    )
  })

  it('should download, unzip, upload CSVs, update job, and start SFN if sortedFileKeys is absent', async () => {
    const mockEvent = {
      isCsvBatch: false,
      importEvent: { importEntity: mockImportEntity, importKey: mockImportKey },
    } as unknown as ImportQueueEvent

    jest
      .spyOn(s3Service.client, 'send')
      .mockResolvedValueOnce({ Body: makeMockStream() } as never)

    await handler.execute(mockEvent)

    // 1. Should update import job with extracted keys
    expect(importService.updateImportJob).toHaveBeenCalledWith(mockImportKey, {
      set: {
        attributes: expect.objectContaining({
          extractedFileKeys: expect.arrayContaining([
            expect.stringContaining('file1.csv'),
            expect.stringContaining('file2.csv'),
          ]),
        }),
      },
    })

    // 2. Should start the Step Function
    expect(sfnService.startExecution).toHaveBeenCalledWith(
      'arn:aws:states:test:zip-import-sfn',
      expect.objectContaining({
        masterJobKey: mockImportKey,
        sortedS3Keys: expect.arrayContaining([
          expect.stringContaining('file1.csv'),
        ]),
      }),
      expect.stringContaining(`${mockTenantCode}-zip-import-`),
    )
  })
})
