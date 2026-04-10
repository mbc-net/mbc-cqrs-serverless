import { Test, TestingModule } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'

import { ZIP_FINALIZATION_HOOKS } from '../import.module-definition'
import { ImportService } from '../import.service'
import { ImportStatusEnum } from '../enum'
import { ZipImportSfnEventHandler } from './zip-import.sfn.event.handler'
import { ZipImportSfnEvent } from './zip-import.sfn.event'

describe('ZipImportSfnEventHandler', () => {
  let handler: ZipImportSfnEventHandler
  let importService: jest.Mocked<ImportService>

  const masterJobKey = { pk: 'ZIP_MASTER#tenant001', sk: 'zip#01JOB' }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZipImportSfnEventHandler,
        {
          provide: ImportService,
          useValue: createMock<ImportService>(),
        },
        {
          provide: ZIP_FINALIZATION_HOOKS,
          useValue: [],
        },
      ],
    }).compile()

    handler = module.get<ZipImportSfnEventHandler>(ZipImportSfnEventHandler)
    importService = module.get(ImportService) as jest.Mocked<ImportService>

    importService.updateStatus.mockResolvedValue(undefined)
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(handler).toBeDefined()
  })

  describe('finalize_zip_job', () => {
    it('should set final status to FAILED when at least one CSV task has importJobStatus FAILED', async () => {
      const event = new ZipImportSfnEvent({
        context: {
          State: {
            Name: 'finalize_zip_job',
            EnteredTime: '2025-01-01T00:00:00.000Z',
            RetryCount: 0,
          },
          Execution: {
            Id: 'arn:aws:states:ap-northeast-1:123456789012:execution:sm:exec',
            Name: 'exec',
            RoleArn: 'arn:aws:iam::123456789012:role/test',
            StartTime: '2025-01-01T00:00:00.000Z',
            Input: {
              masterJobKey,
              parameters: {
                bucket: 'b',
                tenantCode: 'tenant001',
              },
            },
          },
        },
        input: {
          processingResults: [
            {
              result: {
                total: 10,
                succeeded: 10,
                importJobStatus: ImportStatusEnum.FAILED,
              },
            },
            {
              result: {
                total: 5,
                succeeded: 5,
                importJobStatus: ImportStatusEnum.COMPLETED,
              },
            },
          ],
        },
        taskToken: '',
      } as any)

      await handler.execute(event)

      expect(importService.updateStatus).toHaveBeenCalledTimes(1)
      expect(importService.updateStatus).toHaveBeenCalledWith(
        masterJobKey,
        ImportStatusEnum.FAILED,
        {
          result: expect.objectContaining({
            csvTaskFailureCount: 1,
            totalRows: 15,
            processedRows: 15,
            failedRows: 0,
          }),
        },
      )
    })
  })
})
