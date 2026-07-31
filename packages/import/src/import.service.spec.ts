import { UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import { createMock } from '@golevelup/ts-jest'
import {
  DynamoDbService,
  S3Service,
  SnsService,
  StepFunctionService,
} from '@mbc-cqrs-serverless/core'
import { BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test, TestingModule } from '@nestjs/testing'
import { Readable } from 'stream'

import { CreateCsvImportDto } from './dto/create-csv-import.dto'
import { CreateImportDto } from './dto/create-import.dto'
import { CreateZipImportDto } from './dto/create-zip-import.dto'
import { ImportEntity } from './entity'
import { ImportStatusEnum, ProcessingMode } from './enum'
import { IMPORT_STRATEGY_MAP } from './import.module-definition'
import { ImportService } from './import.service'
import { IImportStrategy } from './interface'

// Mock the Upload class from lib-storage to prevent actual S3 calls
jest.mock('@aws-sdk/lib-storage', () => ({
  Upload: jest.fn().mockImplementation(() => ({
    done: jest.fn().mockResolvedValue(true),
  })),
}))

describe('ImportService', () => {
  let service: ImportService
  let dynamoDbService: jest.Mocked<DynamoDbService>
  let snsService: jest.Mocked<SnsService>
  let configService: jest.Mocked<ConfigService>
  let s3Service: jest.Mocked<S3Service>
  let sfnService: jest.Mocked<StepFunctionService>
  let mockStrategy: jest.Mocked<IImportStrategy<any, any>>
  let strategyMap: Map<string, IImportStrategy<any, any>>

  const mockInvokeContext = {
    invokeContext: {
      event: { requestContext: { http: { sourceIp: '127.0.0.1' } } },
      context: { awsRequestId: 'req-123' },
    },
  } as any

  beforeEach(async () => {
    dynamoDbService = createMock<DynamoDbService>({
      getTableName: jest.fn().mockReturnValue('import_tmp'),
      client: { send: jest.fn() } as any,
    })
    snsService = createMock<SnsService>()
    configService = createMock<ConfigService>()
    s3Service = createMock<S3Service>({
      client: { send: jest.fn() } as any,
    })
    sfnService = createMock<StepFunctionService>()

    mockStrategy = {
      transform: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      validate: jest.fn().mockResolvedValue(true),
    } as any

    strategyMap = new Map()
    strategyMap.set('contract', mockStrategy)

    configService.get.mockImplementation((key: string) => {
      if (key === 'SNS_ALARM_TOPIC_ARN') return 'arn:aws:sns:alarm'
      if (key === 'SFN_IMPORT_ZIP_ORCHESTRATOR_ARN') return 'arn:aws:states:zip'
      return null
    })

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportService,
        { provide: DynamoDbService, useValue: dynamoDbService },
        { provide: SnsService, useValue: snsService },
        { provide: ConfigService, useValue: configService },
        { provide: S3Service, useValue: s3Service },
        { provide: StepFunctionService, useValue: sfnService },
        { provide: IMPORT_STRATEGY_MAP, useValue: strategyMap },
      ],
    }).compile()

    service = module.get<ImportService>(ImportService)
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('createWithApi', () => {
    it('should throw BadRequestException if strategy is not found', async () => {
      const dto: CreateImportDto = {
        tableName: 'unknown',
        tenantCode: 't1',
        attributes: {},
      }
      await expect(
        service.createWithApi(dto, mockInvokeContext),
      ).rejects.toThrow(BadRequestException)
    })

    it('should transform, validate, and create import', async () => {
      const dto: CreateImportDto = {
        tableName: 'contract',
        tenantCode: 't1',
        attributes: { id: 1 },
      }
      jest
        .spyOn(service, 'createImport')
        .mockResolvedValue(new ImportEntity({} as any))

      await service.createWithApi(dto, mockInvokeContext)

      expect(mockStrategy.transform).toHaveBeenCalledWith(dto.attributes)
      expect(mockStrategy.validate).toHaveBeenCalled()
      expect(service.createImport).toHaveBeenCalled()
    })
  })

  describe('createCsvJob', () => {
    it('should create a CSV_MASTER_JOB record in DynamoDB', async () => {
      const dto: CreateCsvImportDto = {
        tableName: 'contract',
        tenantCode: 't1',
        bucket: 'b',
        key: 'k.csv',
        processingMode: ProcessingMode.STEP_FUNCTION,
      }
      const result = await service.createCsvJob(dto, mockInvokeContext)

      expect(dynamoDbService.putItem).toHaveBeenCalledWith(
        'import_tmp',
        expect.objectContaining({
          type: 'CSV_MASTER_JOB',
          tenantCode: 't1',
          status: ImportStatusEnum.CREATED,
        }),
      )
      expect(result.type).toEqual('CSV_MASTER_JOB')
    })
  })

  describe('createZipJob', () => {
    it('should skip extraction and trigger Step Function if sortedFileKeys are provided', async () => {
      const dto: CreateZipImportDto = {
        tenantCode: 'tenant1',
        bucket: 'my-bucket',
        key: 'path/to/file.zip',
        tableName: 'contract',
        sortedFileKeys: ['extracted/1.csv', 'extracted/2.csv'],
      }

      ;(dynamoDbService.putItem as jest.Mock).mockResolvedValue(undefined)
      sfnService.startExecution.mockResolvedValue({} as any)

      const result = await service.createZipJob(dto, mockInvokeContext)

      // Master job created
      expect(dynamoDbService.putItem).toHaveBeenCalledWith(
        'import_tmp',
        expect.objectContaining({
          type: 'ZIP_MASTER_JOB',
          status: ImportStatusEnum.PROCESSING,
        }),
      )

      // S3 Download skipped
      expect(s3Service.client.send).not.toHaveBeenCalled()

      // Step function triggered with sorted keys
      expect(sfnService.startExecution).toHaveBeenCalledWith(
        'arn:aws:states:zip',
        expect.objectContaining({
          sortedS3Keys: ['extracted/1.csv', 'extracted/2.csv'],
        }),
        expect.stringContaining('tenant1-zip-import-'),
      )

      expect(result.type).toEqual('ZIP_MASTER_JOB')
    })

    it('should reject sortedFileKeys: [] before creating a job or touching S3', async () => {
      const dto: CreateZipImportDto = {
        tenantCode: 'tenant1',
        bucket: 'my-bucket',
        key: 'path/to/file.zip',
        sortedFileKeys: [],
      }

      await expect(
        service.createZipJob(dto, mockInvokeContext),
      ).rejects.toThrow(/sortedFileKeys cannot be an empty array/)

      expect(dynamoDbService.putItem).not.toHaveBeenCalled()
      expect(s3Service.client.send).not.toHaveBeenCalled()
      expect(sfnService.startExecution).not.toHaveBeenCalled()
    })

    it('should catch errors, rollback status to FAILED, and rethrow', async () => {
      const dto: CreateZipImportDto = {
        tenantCode: 'tenant1',
        bucket: 'my-bucket',
        key: 'path/to/bad_file.zip',
        tableName: 'contract',
      }

      ;(dynamoDbService.putItem as jest.Mock).mockResolvedValue(undefined)
      const error = new Error('Corrupt ZIP file')
      ;(s3Service.client.send as jest.Mock).mockRejectedValue(error)

      jest.spyOn(service, 'updateStatus').mockResolvedValue(undefined)

      await expect(
        service.createZipJob(dto, mockInvokeContext),
      ).rejects.toThrow('Corrupt ZIP file')

      expect(service.updateStatus).toHaveBeenCalledWith(
        expect.any(Object),
        ImportStatusEnum.FAILED,
        { error: { message: 'Corrupt ZIP file' } },
      )
    })
  })

  describe('updateStatus', () => {
    it('should update DynamoDB and publish to SNS', async () => {
      // Use a realistic pk with a '#' so the tenantCode extraction works perfectly
      const key = { pk: 'IMPORT#tenant1', sk: 'SK123' }

      await service.updateStatus(key, ImportStatusEnum.COMPLETED, {
        result: { count: 5 },
      })

      expect(dynamoDbService.updateItem).toHaveBeenCalledWith(
        'import_tmp',
        key,
        {
          set: {
            status: ImportStatusEnum.COMPLETED,
            result: { count: 5 },
            attributes: undefined,
          },
        },
      )

      // THE FIX: Match the exact structure sent to snsService.publish
      expect(snsService.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'import-status',
          pk: 'IMPORT#tenant1',
          sk: 'SK123',
          table: 'import_tmp',
          id: 'IMPORT#tenant1#SK123',
          tenantCode: 'tenant1',
          content: {
            status: ImportStatusEnum.COMPLETED,
            result: { count: 5 },
            attributes: undefined,
          },
        }),
      )
    })
  })

  describe('incrementParentJobCounters', () => {
    it('should atomic increment succeededRows and finalize to COMPLETED if done', async () => {
      const parentKey = { pk: 'PK', sk: 'SK' }

      // Mock DynamoDB send returning the updated attributes where totalRows == processedRows
      ;(dynamoDbService.client.send as jest.Mock).mockResolvedValueOnce({
        Attributes: {
          totalRows: { N: '10' },
          processedRows: { N: '10' },
          succeededRows: { N: '10' },
          failedRows: { N: '0' },
        },
      } as any)

      jest.spyOn(service, 'updateStatus').mockResolvedValue(undefined)

      const result = await service.incrementParentJobCounters(parentKey, true)

      expect(dynamoDbService.client.send).toHaveBeenCalledWith(
        expect.any(UpdateItemCommand),
      )
      expect(service.updateStatus).toHaveBeenCalledWith(
        parentKey,
        ImportStatusEnum.COMPLETED,
        expect.objectContaining({
          result: expect.objectContaining({ succeeded: 10 }),
        }),
      )
      expect(result.succeededRows).toEqual(10)
    })

    it('should finalize to FAILED if done and there are failedRows', async () => {
      const parentKey = { pk: 'PK', sk: 'SK' }

      ;(dynamoDbService.client.send as jest.Mock).mockResolvedValueOnce({
        Attributes: {
          totalRows: { N: '10' },
          processedRows: { N: '10' },
          succeededRows: { N: '9' },
          failedRows: { N: '1' },
        },
      } as any)

      jest.spyOn(service, 'updateStatus').mockResolvedValue(undefined)

      await service.incrementParentJobCounters(parentKey, false)

      expect(service.updateStatus).toHaveBeenCalledWith(
        parentKey,
        ImportStatusEnum.FAILED, // Assert status is FAILED because failedRows > 0
        expect.anything(),
      )
    })
  })

  describe('publishAlarm', () => {
    it('should publish alarm to SNS', async () => {
      const mockEvent = {
        importEvent: {
          importKey: { pk: 'IMPORT#tenant1', sk: 'SK123' },
        },
      } as any

      await service.publishAlarm(mockEvent, 'Task Failed')

      expect(snsService.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'sfn-alarm',
          tenantCode: 'tenant1',
          content: { errorMessage: 'Task Failed' },
        }),
        'arn:aws:sns:alarm',
      )
    })
  })

  describe('getImportByKey', () => {
    it('should return null if item not found', async () => {
      ;(dynamoDbService.getItem as jest.Mock).mockResolvedValue(null)
      const result = await service.getImportByKey({ pk: '1', sk: '2' })
      expect(result).toBeNull()
    })

    it('should return ImportEntity if item is found', async () => {
      dynamoDbService.getItem.mockResolvedValue({
        pk: '1',
        sk: '2',
        type: 'contract',
      })
      const result = await service.getImportByKey({ pk: '1', sk: '2' })
      expect(result).toBeInstanceOf(ImportEntity)
      expect(result?.type).toEqual('contract')
    })
  })
})
