import { createMock } from '@golevelup/ts-jest'
import { StepFunctionService, KEY_SEPARATOR } from '@mbc-cqrs-serverless/core'
import { ConfigService } from '@nestjs/config'
import { Test, TestingModule } from '@nestjs/testing'

import { CSV_IMPORT_PK_PREFIX } from '../constant'
import { ImportStatusEnum } from '../enum/import-status.enum'
import { IMPORT_STRATEGY_MAP } from '../import.module-definition'
import { ImportService } from '../import.service'
import { CsvImportQueueEventHandler } from './csv-import.queue.event.handler'
import { ImportQueueEvent } from './import.queue.event'

describe('CsvImportQueueEventHandler', () => {
  let handler: CsvImportQueueEventHandler
  let importService: jest.Mocked<ImportService>
  let sfnService: jest.Mocked<StepFunctionService>
  let configService: jest.Mocked<ConfigService>

  const mockTenantCode = 'tenant001'
  const mockTableName = 'building'
  const mockImportKey = {
    pk: `${CSV_IMPORT_PK_PREFIX}${KEY_SEPARATOR}${mockTenantCode}`,
    sk: `${mockTableName}#123`,
  }

  const mockImportEntity = {
    id: `${mockImportKey.pk}${KEY_SEPARATOR}${mockImportKey.sk}`,
    attributes: {
      key: 's3-key.csv',
      tableName: mockTableName,
      tenantCode: mockTenantCode,
    },
  }

  beforeEach(async () => {
    importService = createMock<ImportService>()
    sfnService = createMock<StepFunctionService>()
    configService = createMock<ConfigService>()

    configService.get.mockImplementation((key: string) => {
      if (key === 'SFN_IMPORT_CSV_ARN')
        return 'arn:aws:states:test:csv-import-sfn'
      return null
    })

    const mockStrategyMap = new Map()
    mockStrategyMap.set(mockTableName, {}) // Just needs to exist to pass the strategy check

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CsvImportQueueEventHandler,
        { provide: ImportService, useValue: importService },
        { provide: StepFunctionService, useValue: sfnService },
        { provide: ConfigService, useValue: configService },
        { provide: IMPORT_STRATEGY_MAP, useValue: mockStrategyMap },
      ],
    }).compile()

    handler = module.get<CsvImportQueueEventHandler>(CsvImportQueueEventHandler)
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(handler).toBeDefined()
  })

  // ----------------------------------------------------------------
  // GUARD CLAUSE TESTS
  // ----------------------------------------------------------------
  it('should skip processing if event is a high-speed CSV batch', async () => {
    const mockEvent = {
      isCsvBatch: true,
      importEvent: { importEntity: mockImportEntity },
    } as unknown as ImportQueueEvent

    await handler.execute(mockEvent)

    // Ensure it safely exited without touching the database or Step Functions
    expect(importService.updateStatus).not.toHaveBeenCalled()
    expect(sfnService.startExecution).not.toHaveBeenCalled()
  })

  it('should skip processing if prefix is not CSV_IMPORT', async () => {
    const mockEvent = {
      isCsvBatch: false,
      importEvent: {
        importEntity: {
          ...mockImportEntity,
          id: `ZIP_IMPORT#${mockTenantCode}#123`, // Wrong prefix
        },
      },
    } as unknown as ImportQueueEvent

    await handler.execute(mockEvent)

    expect(importService.updateStatus).not.toHaveBeenCalled()
    expect(sfnService.startExecution).not.toHaveBeenCalled()
  })

  // ----------------------------------------------------------------
  // SUCCESS / ERROR FLOWS
  // ----------------------------------------------------------------
  it('should start SFN and update status to PROCESSING', async () => {
    const mockEvent = {
      isCsvBatch: false,
      importEvent: { importEntity: mockImportEntity, importKey: mockImportKey },
    } as unknown as ImportQueueEvent

    await handler.execute(mockEvent)

    expect(importService.updateStatus).toHaveBeenCalledWith(
      mockImportKey,
      ImportStatusEnum.PROCESSING,
    )
    expect(sfnService.startExecution).toHaveBeenCalledWith(
      'arn:aws:states:test:csv-import-sfn',
      expect.objectContaining({ sourceId: mockImportEntity.id }),
      expect.stringContaining(`${mockTenantCode}-${mockTableName}-`),
    )
  })

  it('should update status to FAILED if SFN fails to start', async () => {
    const mockEvent = {
      isCsvBatch: false,
      importEvent: { importEntity: mockImportEntity, importKey: mockImportKey },
    } as unknown as ImportQueueEvent

    sfnService.startExecution.mockRejectedValue(new Error('SFN start failed'))

    await expect(handler.execute(mockEvent)).rejects.toThrow('SFN start failed')

    expect(importService.updateStatus).toHaveBeenCalledWith(
      mockImportKey,
      ImportStatusEnum.FAILED,
      expect.objectContaining({
        error: expect.objectContaining({
          message: expect.stringContaining('SFN start failed'),
        }),
      }),
    )
  })
})
