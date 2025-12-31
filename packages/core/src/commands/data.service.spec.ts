/**
 * DataService Test Suite
 *
 * Tests the read-side data service of the CQRS pattern.
 * DataService handles querying the projected/materialized view data.
 *
 * Key responsibilities tested:
 * - Publishing command data to the data (read) table
 * - Retrieving single items by key
 * - Listing items by partition key with pagination
 * - Preserving created metadata when updating existing items
 */
import { Test, TestingModule } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'
import { DataService } from './data.service'
import { DynamoDbService } from '../data-store/dynamodb.service'
import { CommandModel, DataModel, DetailKey } from '../interfaces'
import { MODULE_OPTIONS_TOKEN } from './command.module-definition'

describe('DataService', () => {
  let service: DataService
  let dynamoDbService: jest.Mocked<DynamoDbService>

  const mockCommandModel: CommandModel = {
    pk: 'test-pk',
    sk: 'test-sk@1',
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

  const mockDataModel: DataModel = {
    pk: 'test-pk',
    sk: 'test-sk',
    id: 'test-id',
    code: 'test-code',
    name: 'test-name',
    version: 1,
    tenantCode: 'test-tenant',
    type: 'test-type',
    isDeleted: false,
    attributes: { key: 'value' },
    cpk: 'test-pk',
    csk: 'test-sk@1',
    requestId: 'test-request-id',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'test-user',
    updatedBy: 'test-user',
  }

  beforeEach(async () => {
    const mockDynamoDbService = createMock<DynamoDbService>()
    mockDynamoDbService.getTableName.mockReturnValue('test-data-table')

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataService,
        {
          provide: MODULE_OPTIONS_TOKEN,
          useValue: { tableName: 'test-table' },
        },
        {
          provide: DynamoDbService,
          useValue: mockDynamoDbService,
        },
      ],
    }).compile()

    service = module.get<DataService>(DataService)
    dynamoDbService = module.get(DynamoDbService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  /**
   * Tests for publish method
   * Scenario: Projecting command data to the read-side data table
   * Maintains CQRS separation by syncing command changes to query store
   */
  describe('publish', () => {
    /** Preserves original creation metadata when updating existing item */
    it('should publish command model and return data model', async () => {
      const existingData: DataModel = {
        ...mockDataModel,
        createdAt: new Date('2023-01-01'),
        createdBy: 'original-user',
        createdIp: '192.168.1.1',
      }

      dynamoDbService.getItem.mockResolvedValue(existingData)
      dynamoDbService.putItem.mockResolvedValue(mockDataModel)

      const result = await service.publish(mockCommandModel)

      expect(dynamoDbService.getItem).toHaveBeenCalledWith('test-data-table', {
        pk: 'test-pk',
        sk: 'test-sk',
      })
      expect(dynamoDbService.putItem).toHaveBeenCalledWith(
        'test-data-table',
        expect.objectContaining({
          pk: 'test-pk',
          sk: 'test-sk',
          id: 'test-id',
          code: 'test-code',
          name: 'test-name',
          version: 1,
          cpk: 'test-pk',
          csk: 'test-sk@1',
          createdAt: existingData.createdAt,
          createdBy: existingData.createdBy,
          createdIp: existingData.createdIp,
        })
      )
      expect(result).toEqual(expect.objectContaining({
        pk: 'test-pk',
        sk: 'test-sk',
        id: 'test-id',
        version: 1,
      }))
    })

    /** Uses command metadata for new items (no existing data) */
    it('should handle new item creation when no existing data', async () => {
      dynamoDbService.getItem.mockResolvedValue(null)
      dynamoDbService.putItem.mockResolvedValue(mockDataModel)

      const result = await service.publish(mockCommandModel)

      expect(result).toEqual(expect.objectContaining({
        pk: 'test-pk',
        sk: 'test-sk',
        createdAt: mockCommandModel.createdAt,
        createdBy: mockCommandModel.createdBy,
      }))
    })

    /** Propagates DynamoDB errors to caller */
    it('should handle publish errors', async () => {
      dynamoDbService.getItem.mockResolvedValue(null)
      const error = new Error('DynamoDB error')
      dynamoDbService.putItem.mockRejectedValue(error)

      await expect(service.publish(mockCommandModel)).rejects.toThrow('DynamoDB error')
    })
  })

  /**
   * Tests for getItem method
   * Scenario: Single item retrieval by partition key + sort key
   */
  describe('getItem', () => {
    /** Successfully retrieves item with matching key */
    it('should get item from DynamoDB', async () => {
      const key: DetailKey = { pk: 'test-pk', sk: 'test-sk' }
      
      dynamoDbService.getItem.mockResolvedValue(mockDataModel)

      const result = await service.getItem(key)

      expect(dynamoDbService.getItem).toHaveBeenCalledWith('test-data-table', key)
      expect(result).toEqual(mockDataModel)
    })

    /** Returns null for non-existent keys */
    it('should return null when item not found', async () => {
      const key: DetailKey = { pk: 'test-pk', sk: 'test-sk' }

      dynamoDbService.getItem.mockResolvedValue(null)

      const result = await service.getItem(key)

      expect(result).toBeNull()
    })
  })

  /**
   * Tests for listItemsByPk method
   * Scenario: Querying multiple items by partition key with optional filters
   * Supports pagination via lastSk cursor
   */
  describe('listItemsByPk', () => {
    /** Returns items and pagination cursor */
    it('should list items by partition key', async () => {
      const pk = 'test-pk'
      const mockItems = [mockDataModel]

      dynamoDbService.listItemsByPk.mockResolvedValue({
        lastSk: 'last-sk',
        items: mockItems,
      })

      const result = await service.listItemsByPk(pk)

      expect(dynamoDbService.listItemsByPk).toHaveBeenCalledWith(
        'test-data-table',
        pk,
        undefined,
        undefined,
        undefined,
        undefined
      )
      expect(result.lastSk).toBe('last-sk')
      expect(result.items).toHaveLength(1)
    })

    /** Handles empty result set gracefully */
    it('should handle empty results', async () => {
      const pk = 'test-pk'

      dynamoDbService.listItemsByPk.mockResolvedValue({
        lastSk: null,
        items: [],
      })

      const result = await service.listItemsByPk(pk)

      expect(result.items).toEqual([])
      expect(result.lastSk).toBeNull()
    })

    /** Passes filter options (sk prefix, limit, order) to DynamoDB */
    it('should handle query with options', async () => {
      const pk = 'test-pk'
      const options = {
        sk: {
          skExpession: 'begins_with(sk, :sk)',
          skAttributeValues: { ':sk': 'prefix' },
        },
        limit: 10,
        order: 'desc' as const,
      }

      dynamoDbService.listItemsByPk.mockResolvedValue({
        lastSk: null,
        items: [],
      })

      await service.listItemsByPk(pk, options)

      expect(dynamoDbService.listItemsByPk).toHaveBeenCalledWith(
        'test-data-table',
        pk,
        options.sk,
        undefined,
        10,
        'desc'
      )
    })
  })
})
