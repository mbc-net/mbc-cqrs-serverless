import { Test, TestingModule } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'
import { HistoryService } from './history.service'
import { DataService } from './data.service'
import { DynamoDbService } from '../data-store/dynamodb.service'
import { TtlService } from './ttl.service'
import { ConfigService } from '@nestjs/config'
import { DataModel, DetailKey } from '../interfaces'
import { MODULE_OPTIONS_TOKEN } from './command.module-definition'

describe('HistoryService', () => {
  let service: HistoryService
  let dataService: jest.Mocked<DataService>
  let dynamoDbService: jest.Mocked<DynamoDbService>
  let ttlService: jest.Mocked<TtlService>
  let configService: jest.Mocked<ConfigService>

  const mockDataModel: DataModel = {
    pk: 'TEST#test-tenant',
    sk: 'test-sk',
    id: 'test-id',
    code: 'test-code',
    name: 'test-name',
    version: 1,
    tenantCode: 'test-tenant',
    type: 'test-type',
    isDeleted: false,
    attributes: { key: 'value' },
    requestId: 'test-request-id',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'test-user',
    updatedBy: 'test-user',
  }

  beforeEach(async () => {
    const mockDynamoDbService = createMock<DynamoDbService>()
    mockDynamoDbService.getTableName.mockReturnValue('test-history-table')

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoryService,
        {
          provide: MODULE_OPTIONS_TOKEN,
          useValue: { tableName: 'test-table' },
        },
        {
          provide: DynamoDbService,
          useValue: mockDynamoDbService,
        },
        {
          provide: DataService,
          useValue: createMock<DataService>(),
        },
        {
          provide: TtlService,
          useValue: createMock<TtlService>(),
        },
        {
          provide: ConfigService,
          useValue: createMock<ConfigService>(),
        },
      ],
    }).compile()

    service = module.get<HistoryService>(HistoryService)
    dataService = module.get(DataService)
    dynamoDbService = module.get(DynamoDbService)
    ttlService = module.get(TtlService)
    configService = module.get(ConfigService)

    configService.get.mockReturnValue(86400)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('publish', () => {
    it('should publish data with TTL', async () => {
      const key: DetailKey = { pk: 'TEST#test-tenant', sk: 'test-sk' }
      const testData = { ...mockDataModel }

      dataService.getItem.mockResolvedValue(testData)
      ttlService.calculateTtl.mockResolvedValue(86400)
      dynamoDbService.putItem.mockResolvedValue(testData)

      const result = await service.publish(key)

      expect(dataService.getItem).toHaveBeenCalledWith(key)
      expect(ttlService.calculateTtl).toHaveBeenCalledWith('history', 'test-tenant')
      expect(dynamoDbService.putItem).toHaveBeenCalledWith('test-history-table', expect.objectContaining({
        ...testData,
        sk: 'test-sk@1',
        ttl: 86400,
      }))
      expect(result).toEqual(testData)
    })

    it('should return null when data not found', async () => {
      const key: DetailKey = { pk: 'TEST#test-tenant', sk: 'test-sk' }

      dataService.getItem.mockResolvedValue(null as any)

      const result = await service.publish(key)

      expect(dataService.getItem).toHaveBeenCalledWith(key)
      expect(result).toBeNull()
      expect(ttlService.calculateTtl).not.toHaveBeenCalled()
      expect(dynamoDbService.putItem).not.toHaveBeenCalled()
    })

    it('should handle publish errors', async () => {
      const key: DetailKey = { pk: 'TEST#test-tenant', sk: 'test-sk' }
      const testData = { ...mockDataModel }
      const error = new Error('Publish failed')

      dataService.getItem.mockResolvedValue(testData)
      ttlService.calculateTtl.mockResolvedValue(86400)
      dynamoDbService.putItem.mockRejectedValue(error)

      await expect(service.publish(key)).rejects.toThrow('Publish failed')
    })
  })

  describe('getItem', () => {
    it('should get item from DynamoDB', async () => {
      const key: DetailKey = { pk: 'TEST#test-tenant', sk: 'test-sk' }
      
      dynamoDbService.getItem.mockResolvedValue(mockDataModel)

      const result = await service.getItem(key)

      expect(dynamoDbService.getItem).toHaveBeenCalledWith('test-history-table', key)
      expect(result).toEqual(mockDataModel)
    })

    it('should return null when item not found', async () => {
      const key: DetailKey = { pk: 'TEST#test-tenant', sk: 'test-sk' }

      dynamoDbService.getItem.mockResolvedValue(null)

      const result = await service.getItem(key)

      expect(result).toBeNull()
    })

    it('should handle get item errors', async () => {
      const key: DetailKey = { pk: 'TEST#test-tenant', sk: 'test-sk' }
      const error = new Error('Get item failed')

      dynamoDbService.getItem.mockRejectedValue(error)

      await expect(service.getItem(key)).rejects.toThrow('Get item failed')
    })
  })
})
