/**
 * ImportService Unit Tests
 *
 * 概要 / Overview:
 * ImportServiceのユニットテストスイート。特にincrementParentJobCountersメソッドの
 * 正しいステータス設定を検証します。
 *
 * Unit test suite for ImportService. Specifically verifies correct status
 * determination in incrementParentJobCounters method.
 *
 * 目的 / Purpose:
 * - 子ジョブ失敗時にマスタージョブがFAILEDステータスになることを検証
 * - 全子ジョブ成功時にマスタージョブがCOMPLETEDステータスになることを検証
 * - カウンターのアトミック更新が正しく動作することを検証
 *
 * - Verify master job gets FAILED status when child jobs fail
 * - Verify master job gets COMPLETED status when all children succeed
 * - Verify atomic counter updates work correctly
 */
import { Test, TestingModule } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'
import { ConfigService } from '@nestjs/config'
import {
  DynamoDbService,
  SnsService,
  S3Service,
  KEY_SEPARATOR,
} from '@mbc-cqrs-serverless/core'
import { ImportService } from './import.service'
import { ImportStatusEnum } from './enum'
import { IMPORT_STRATEGY_MAP } from './import.module-definition'
import { CSV_IMPORT_PK_PREFIX } from './constant'

// Mock UpdateItemCommand
jest.mock('@aws-sdk/client-dynamodb', () => ({
  UpdateItemCommand: jest.fn().mockImplementation((params) => params),
}))

jest.mock('@aws-sdk/util-dynamodb', () => ({
  marshall: jest.fn((obj) => obj),
  unmarshall: jest.fn((obj) => obj),
}))

describe('ImportService', () => {
  let service: ImportService
  let dynamoDbService: jest.Mocked<DynamoDbService>
  let snsService: jest.Mocked<SnsService>
  let mockDdbClient: { send: jest.Mock }

  const mockTableName = 'test-import_tmp'
  const mockPk = `${CSV_IMPORT_PK_PREFIX}${KEY_SEPARATOR}tenant001`
  const mockSk = 'building#01ABC123'

  beforeEach(async () => {
    mockDdbClient = {
      send: jest.fn(),
    }

    const mockDynamoDbService = {
      getTableName: jest.fn().mockReturnValue(mockTableName),
      client: mockDdbClient,
      updateItem: jest.fn().mockResolvedValue({}),
      putItem: jest.fn().mockResolvedValue({}),
      getItem: jest.fn().mockResolvedValue(null),
    }

    const mockSnsService = {
      publish: jest.fn().mockResolvedValue({}),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportService,
        {
          provide: DynamoDbService,
          useValue: mockDynamoDbService,
        },
        {
          provide: SnsService,
          useValue: mockSnsService,
        },
        {
          provide: S3Service,
          useValue: createMock<S3Service>(),
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('arn:aws:sns:test:alarm-topic'),
          },
        },
        {
          provide: IMPORT_STRATEGY_MAP,
          useValue: new Map(),
        },
      ],
    }).compile()

    service = module.get<ImportService>(ImportService)
    dynamoDbService = module.get(DynamoDbService) as jest.Mocked<DynamoDbService>
    snsService = module.get(SnsService) as jest.Mocked<SnsService>

    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('incrementParentJobCounters', () => {
    const parentKey = { pk: mockPk, sk: mockSk }

    /**
     * Test: Master job should be COMPLETED when all children succeed
     * マスタージョブは全子ジョブ成功時にCOMPLETEDになるべき
     */
    it('should set final status to COMPLETED when all children succeed', async () => {
      // Setup: All jobs processed, no failures
      mockDdbClient.send.mockResolvedValue({
        Attributes: {
          pk: mockPk,
          sk: mockSk,
          totalRows: 3,
          processedRows: 3,
          succeededRows: 3,
          failedRows: 0,
        },
      })

      await service.incrementParentJobCounters(parentKey, true)

      // Verify updateStatus was called with COMPLETED
      expect(dynamoDbService.updateItem).toHaveBeenCalledWith(
        mockTableName,
        parentKey,
        expect.objectContaining({
          set: expect.objectContaining({
            status: ImportStatusEnum.COMPLETED,
          }),
        }),
      )
    })

    /**
     * Test: Master job should be FAILED when any child fails
     * マスタージョブは子ジョブが1つでも失敗したらFAILEDになるべき
     */
    it('should set final status to FAILED when any child fails', async () => {
      // Setup: All jobs processed, some failures
      mockDdbClient.send.mockResolvedValue({
        Attributes: {
          pk: mockPk,
          sk: mockSk,
          totalRows: 3,
          processedRows: 3,
          succeededRows: 2,
          failedRows: 1,
        },
      })

      await service.incrementParentJobCounters(parentKey, false)

      // Verify updateStatus was called with FAILED
      expect(dynamoDbService.updateItem).toHaveBeenCalledWith(
        mockTableName,
        parentKey,
        expect.objectContaining({
          set: expect.objectContaining({
            status: ImportStatusEnum.FAILED,
          }),
        }),
      )
    })

    /**
     * Test: Should not finalize if not all jobs are processed
     * 全ジョブ処理完了前はファイナライズしないこと
     */
    it('should not finalize status if not all jobs are processed', async () => {
      // Setup: Some jobs still pending
      mockDdbClient.send.mockResolvedValue({
        Attributes: {
          pk: mockPk,
          sk: mockSk,
          totalRows: 5,
          processedRows: 3,
          succeededRows: 2,
          failedRows: 1,
        },
      })

      await service.incrementParentJobCounters(parentKey, true)

      // Verify updateStatus was NOT called (job not complete)
      expect(dynamoDbService.updateItem).not.toHaveBeenCalled()
    })

    /**
     * Test: Should increment succeededRows when child succeeds
     * 子ジョブ成功時にsucceededRowsがインクリメントされること
     */
    it('should increment succeededRows when child succeeds', async () => {
      mockDdbClient.send.mockResolvedValue({
        Attributes: {
          pk: mockPk,
          sk: mockSk,
          totalRows: 5,
          processedRows: 1,
          succeededRows: 1,
          failedRows: 0,
        },
      })

      await service.incrementParentJobCounters(parentKey, true)

      // Verify the atomic update command was sent
      expect(mockDdbClient.send).toHaveBeenCalled()
    })

    /**
     * Test: Should increment failedRows when child fails
     * 子ジョブ失敗時にfailedRowsがインクリメントされること
     */
    it('should increment failedRows when child fails', async () => {
      mockDdbClient.send.mockResolvedValue({
        Attributes: {
          pk: mockPk,
          sk: mockSk,
          totalRows: 5,
          processedRows: 1,
          succeededRows: 0,
          failedRows: 1,
        },
      })

      await service.incrementParentJobCounters(parentKey, false)

      // Verify the atomic update command was sent
      expect(mockDdbClient.send).toHaveBeenCalled()
    })

    /**
     * Test: Should publish SNS notification when job finalizes
     * ジョブ完了時にSNS通知が発行されること
     */
    it('should publish SNS notification when job finalizes with failures', async () => {
      mockDdbClient.send.mockResolvedValue({
        Attributes: {
          pk: mockPk,
          sk: mockSk,
          totalRows: 2,
          processedRows: 2,
          succeededRows: 1,
          failedRows: 1,
        },
      })

      await service.incrementParentJobCounters(parentKey, false)

      // Verify SNS publish was called via updateStatus
      expect(snsService.publish).toHaveBeenCalled()
    })
  })
})
