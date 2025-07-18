import { Test, TestingModule } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { MasterDataService } from './master-data.service'
import { 
  CommandService, 
  DataService, 
  getUserContext, 
  UserContext,
  DataModel,
  CommandModel,
  DataListEntity,
  DataEntity
} from '@mbc-cqrs-serverless/core'
import { PRISMA_SERVICE } from '../master.module-definition'
import {
  CreateMasterDataDto,
  CustomMasterDataSearchDto,
  MasterDataSearchDto,
  MasterDataCreateDto,
  MasterDataUpdateDto,
  UpdateDataSettingDto,
} from '../dto'
import { MasterDataEntity, MasterDataListEntity } from '../entities'
import { MasterRdsEntity, MasterRdsListEntity } from '../dto'

jest.mock('@mbc-cqrs-serverless/core', () => ({
  ...jest.requireActual('@mbc-cqrs-serverless/core'),
  getUserContext: jest.fn(),
}))

describe('MasterDataService', () => {
  let service: MasterDataService
  let prismaService: any
  let commandService: jest.Mocked<CommandService>
  let dataService: jest.Mocked<DataService>
  let mockGetUserContext: jest.MockedFunction<typeof getUserContext>

  const mockUserContext: UserContext = {
    tenantCode: 'TEST_TENANT',
    userId: 'test-user-id',
    tenantRole: 'ADMIN',
  }

  const mockInvokeContext = {
    context: { awsRequestId: 'test-request-id' },
    event: { requestContext: { http: { sourceIp: '127.0.0.1' } } },
  }

  beforeEach(async () => {
    const mockPrismaService = {
      master: {
        findMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
    }

    mockGetUserContext = getUserContext as jest.MockedFunction<typeof getUserContext>
    mockGetUserContext.mockReturnValue(mockUserContext)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MasterDataService,
        {
          provide: PRISMA_SERVICE,
          useValue: mockPrismaService,
        },
        {
          provide: CommandService,
          useValue: createMock<CommandService>(),
        },
        {
          provide: DataService,
          useValue: createMock<DataService>(),
        },
      ],
    }).compile()

    service = module.get<MasterDataService>(MasterDataService)
    prismaService = module.get(PRISMA_SERVICE)
    commandService = module.get(CommandService)
    dataService = module.get(DataService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('listByRds', () => {
    it('should list master data by RDS with search criteria', async () => {
      const searchDto: CustomMasterDataSearchDto = {
        keyword: 'test',
        code: 'TEST_CODE',
        settingCode: 'SETTING_CODE',
        pageSize: 10,
        page: 1,
        orderBys: ['seq', 'masterCode'],
      }

      const mockDeletedSettings = [{ masterCode: 'DELETED_CODE' }]
      const mockItems = [
        {
          id: 'test-id-1',
          masterCode: 'CODE1',
          name: 'Test Item 1',
          tenantCode: 'TEST_TENANT',
          masterType: 'DATA',
          seq: 1,
        },
      ]

      prismaService.master.findMany
        .mockResolvedValueOnce(mockDeletedSettings)
        .mockResolvedValueOnce(mockItems)
      prismaService.master.count.mockResolvedValue(1)

      const result = await service.listByRds(searchDto, { invokeContext: mockInvokeContext })

      expect(result).toBeInstanceOf(MasterRdsListEntity)
      expect(result.total).toBe(1)
      expect(result.items).toHaveLength(1)
      expect(result.items[0]).toBeInstanceOf(MasterRdsEntity)
      expect(prismaService.master.findMany).toHaveBeenCalledTimes(2)
      expect(prismaService.master.count).toHaveBeenCalledTimes(1)
    })

    it('should handle empty search results', async () => {
      const searchDto: CustomMasterDataSearchDto = {
        pageSize: 10,
        page: 1,
      }

      prismaService.master.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
      prismaService.master.count.mockResolvedValue(0)

      const result = await service.listByRds(searchDto, { invokeContext: mockInvokeContext })

      expect(result.total).toBe(0)
      expect(result.items).toHaveLength(0)
    })

    it('should filter by deleted settings', async () => {
      const searchDto: CustomMasterDataSearchDto = {
        isDeleted: false,
        pageSize: 10,
        page: 1,
      }

      const mockDeletedSettings = [
        { masterCode: 'DELETED_CODE1' },
        { masterCode: 'DELETED_CODE2' },
      ]

      prismaService.master.findMany
        .mockResolvedValueOnce(mockDeletedSettings)
        .mockResolvedValueOnce([])
      prismaService.master.count.mockResolvedValue(0)

      await service.listByRds(searchDto, { invokeContext: mockInvokeContext })

      expect(prismaService.master.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            masterTypeCode: {
              notIn: ['DELETED_CODE1', 'DELETED_CODE2'],
            },
            isDeleted: false,
          }),
        })
      )
    })
  })

  describe('list', () => {
    it('should list master data by tenant and setting code', async () => {
      const searchDto: MasterDataSearchDto = {
        tenantCode: 'TEST_TENANT',
        settingCode: 'SETTING_CODE',
      }

      const mockResponse: DataListEntity = {
        items: [
          new DataEntity({
            pk: 'MASTER#TEST_TENANT',
            sk: 'SETTING_CODE#DATA1',
            id: 'test-id',
            code: 'DATA1',
            name: 'Test Data',
            version: 1,
            type: 'MASTER',
            tenantCode: 'TEST_TENANT',
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ],
      }

      dataService.listItemsByPk.mockResolvedValue(mockResponse)

      const result = await service.list(searchDto)

      expect(result).toBeInstanceOf(MasterDataListEntity)
      expect(dataService.listItemsByPk).toHaveBeenCalledWith(
        'MASTER#TEST_TENANT',
        expect.objectContaining({
          sk: expect.objectContaining({
            skExpession: 'begins_with(sk, :settingCode)',
            skAttributeValues: {
              ':settingCode': 'SETTING_CODE#',
            },
          }),
        })
      )
    })

    it('should use COMMON tenant when tenantCode is not provided', async () => {
      const searchDto: MasterDataSearchDto = {
        settingCode: 'SETTING_CODE',
      }

      const mockResponse: DataListEntity = { 
        items: [],
      }
      dataService.listItemsByPk.mockResolvedValue(mockResponse)

      await service.list(searchDto)

      expect(dataService.listItemsByPk).toHaveBeenCalledWith(
        'MASTER#COMMON',
        expect.any(Object)
      )
    })
  })

  describe('get', () => {
    it('should get master data by key', async () => {
      const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING#DATA1' }
      const mockData: DataModel = {
        pk: key.pk,
        sk: key.sk,
        id: 'test-id',
        code: 'DATA1',
        name: 'Test Data',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(mockData)

      const result = await service.get(key)

      expect(result).toBeInstanceOf(MasterDataEntity)
      expect(dataService.getItem).toHaveBeenCalledWith(key)
    })
  })

  describe('create', () => {
    it('should create new master data when not exists', async () => {
      const createDto: CreateMasterDataDto = {
        settingCode: 'SETTING_CODE',
        code: 'DATA_CODE',
        tenantCode: 'TEST_TENANT',
        name: 'Test Data',
        seq: 1,
        attributes: { key: 'value' },
      }

      dataService.getItem.mockResolvedValue(null)
      const mockCommandResult: CommandModel = {
        id: 'MASTER#TEST_TENANT#SETTING_CODE#DATA_CODE',
        pk: 'MASTER#TEST_TENANT',
        sk: 'SETTING_CODE#DATA_CODE',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        name: createDto.name,
        code: createDto.code,
        seq: createDto.seq,
        attributes: createDto.attributes,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      commandService.publishAsync.mockResolvedValue(mockCommandResult)

      const result = await service.create(createDto, { invokeContext: mockInvokeContext })

      expect(result).toBeInstanceOf(MasterDataEntity)
      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'MASTER#TEST_TENANT#SETTING_CODE#DATA_CODE',
          pk: 'MASTER#TEST_TENANT',
          sk: 'SETTING_CODE#DATA_CODE',
          version: 0,
          type: 'MASTER',
          isDeleted: false,
          code: createDto.code,
          name: createDto.name,
          seq: createDto.seq,
          attributes: createDto.attributes,
          settingCode: 'SETTING_CODE',
          tenantCode: 'TEST_TENANT',
        }),
        { invokeContext: mockInvokeContext }
      )
    })

    it('should throw BadRequestException when data already exists', async () => {
      const createDto: CreateMasterDataDto = {
        settingCode: 'SETTING_CODE',
        code: 'DATA_CODE',
        tenantCode: 'TEST_TENANT',
        name: 'Test Data',
        seq: 1,
      }

      const existingData: DataModel = {
        id: 'existing-id',
        pk: 'MASTER#TEST_TENANT',
        sk: 'SETTING_CODE#DATA_CODE',
        code: 'DATA_CODE',
        name: 'Existing Data',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      dataService.getItem.mockResolvedValue(existingData)

      await expect(service.create(createDto, { invokeContext: mockInvokeContext }))
        .rejects.toThrow(BadRequestException)
      expect(commandService.publishAsync).not.toHaveBeenCalled()
    })

    it('should create when existing data is deleted', async () => {
      const createDto: CreateMasterDataDto = {
        settingCode: 'SETTING_CODE',
        code: 'DATA_CODE',
        tenantCode: 'TEST_TENANT',
        name: 'Test Data',
        seq: 1,
      }

      const existingDeletedData: DataModel = {
        id: 'existing-id',
        pk: 'MASTER#TEST_TENANT',
        sk: 'SETTING_CODE#DATA_CODE',
        code: 'DATA_CODE',
        name: 'Deleted Data',
        version: 2,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(existingDeletedData)
      const mockCommandResult: CommandModel = {
        id: 'MASTER#TEST_TENANT#SETTING_CODE#DATA_CODE',
        pk: 'MASTER#TEST_TENANT',
        sk: 'SETTING_CODE#DATA_CODE',
        version: 2,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        name: createDto.name,
        code: createDto.code,
        seq: createDto.seq,
        attributes: createDto.attributes,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      commandService.publishAsync.mockResolvedValue(mockCommandResult)

      const result = await service.create(createDto, { invokeContext: mockInvokeContext })

      expect(result).toBeInstanceOf(MasterDataEntity)
      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 2,
        }),
        { invokeContext: mockInvokeContext }
      )
    })
  })

  describe('update', () => {
    it('should update existing master data', async () => {
      const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING#DATA1' }
      const updateDto: UpdateDataSettingDto = {
        name: 'Updated Name',
        seq: 2,
        attributes: { updated: true },
      }

      const existingData: DataModel = {
        id: 'test-id',
        pk: key.pk,
        sk: key.sk,
        version: 1,
        code: 'DATA1',
        name: 'Original Name',
        seq: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: false,
        attributes: { original: true },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(existingData)
      const mockUpdateResult: CommandModel = {
        ...existingData,
        name: updateDto.name!,
        seq: updateDto.seq!,
        attributes: updateDto.attributes!,
        updatedAt: new Date(),
      }
      commandService.publishPartialUpdateAsync.mockResolvedValue(mockUpdateResult)

      const result = await service.update(key, updateDto, { invokeContext: mockInvokeContext })

      expect(result).toBeInstanceOf(MasterDataEntity)
      expect(commandService.publishPartialUpdateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: existingData.id,
          pk: existingData.pk,
          sk: existingData.sk,
          version: existingData.version,
          name: updateDto.name,
          seq: updateDto.seq,
          attributes: updateDto.attributes,
        }),
        { invokeContext: mockInvokeContext }
      )
    })

    it('should throw NotFoundException when data does not exist', async () => {
      const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING#DATA1' }
      const updateDto: UpdateDataSettingDto = {
        name: 'Updated Name',
      }

      dataService.getItem.mockResolvedValue(null)

      await expect(service.update(key, updateDto, { invokeContext: mockInvokeContext }))
        .rejects.toThrow(NotFoundException)
      expect(commandService.publishPartialUpdateAsync).not.toHaveBeenCalled()
    })

    it('should preserve existing values when update fields are not provided', async () => {
      const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING#DATA1' }
      const updateDto: UpdateDataSettingDto = {
        seq: 2,
      }

      const existingData: DataModel = {
        id: 'test-id',
        pk: key.pk,
        sk: key.sk,
        version: 1,
        code: 'DATA1',
        name: 'Original Name',
        seq: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: false,
        attributes: { original: true },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(existingData)
      const mockUpdateResult: CommandModel = {
        ...existingData,
        seq: updateDto.seq!,
        updatedAt: new Date(),
      }
      commandService.publishPartialUpdateAsync.mockResolvedValue(mockUpdateResult)

      await service.update(key, updateDto, { invokeContext: mockInvokeContext })

      expect(commandService.publishPartialUpdateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: existingData.name,
          seq: updateDto.seq,
          isDeleted: existingData.isDeleted,
          attributes: existingData.attributes,
        }),
        { invokeContext: mockInvokeContext }
      )
    })
  })

  describe('delete', () => {
    it('should soft delete existing master data', async () => {
      const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING#DATA1' }
      const existingData: DataModel = {
        id: 'test-id',
        pk: key.pk,
        sk: key.sk,
        version: 1,
        code: 'DATA1',
        name: 'Test Data',
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(existingData)
      const mockDeleteResult: CommandModel = {
        ...existingData,
        isDeleted: true,
        updatedAt: new Date(),
      }
      commandService.publishPartialUpdateAsync.mockResolvedValue(mockDeleteResult)

      const result = await service.delete(key, { invokeContext: mockInvokeContext })

      expect(result).toBeInstanceOf(MasterDataEntity)
      expect(commandService.publishPartialUpdateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          ...existingData,
          isDeleted: true,
        }),
        { invokeContext: mockInvokeContext }
      )
    })

    it('should throw NotFoundException when data does not exist', async () => {
      const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING#DATA1' }

      dataService.getItem.mockResolvedValue(null)

      await expect(service.delete(key, { invokeContext: mockInvokeContext }))
        .rejects.toThrow(NotFoundException)
      expect(commandService.publishPartialUpdateAsync).not.toHaveBeenCalled()
    })

    it('should throw BadRequestException when data is already deleted', async () => {
      const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING#DATA1' }
      const existingData: DataModel = {
        id: 'test-id',
        pk: key.pk,
        sk: key.sk,
        code: 'DATA1',
        name: 'Test Data',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(existingData)

      await expect(service.delete(key, { invokeContext: mockInvokeContext }))
        .rejects.toThrow(BadRequestException)
      expect(commandService.publishPartialUpdateAsync).not.toHaveBeenCalled()
    })
  })

  describe('checkExistCode', () => {
    it('should return true when code exists and is not deleted', async () => {
      const mockData: DataModel = {
        id: 'test-id',
        pk: 'MASTER#TEST_TENANT',
        sk: 'SETTING_TYPE#CODE1',
        code: 'CODE1',
        name: 'Test Data',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(mockData)

      const result = await service.checkExistCode('TEST_TENANT', 'SETTING_TYPE', 'CODE1')

      expect(result).toBe(true)
      expect(dataService.getItem).toHaveBeenCalledWith({
        pk: 'MASTER#TEST_TENANT',
        sk: 'SETTING_TYPE#CODE1',
      })
    })

    it('should return false when code does not exist', async () => {
      dataService.getItem.mockResolvedValue(null)

      const result = await service.checkExistCode('TEST_TENANT', 'SETTING_TYPE', 'CODE1')

      expect(result).toBe(false)
    })

    it('should return false when code exists but is deleted', async () => {
      const mockData: DataModel = {
        id: 'test-id',
        pk: 'MASTER#TEST_TENANT',
        sk: 'SETTING_TYPE#CODE1',
        code: 'CODE1',
        name: 'Test Data',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(mockData)

      const result = await service.checkExistCode('TEST_TENANT', 'SETTING_TYPE', 'CODE1')

      expect(result).toBe(false)
    })
  })

  describe('getDetail', () => {
    it('should get master data detail', async () => {
      const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING#DATA1' }
      const mockData: DataModel = {
        pk: key.pk,
        sk: key.sk,
        id: 'test-id',
        code: 'DATA1',
        name: 'Test Data',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(mockData)

      const result = await service.getDetail(key)

      expect(result).toBeInstanceOf(MasterRdsEntity)
      expect(dataService.getItem).toHaveBeenCalledWith(key)
    })

    it('should throw NotFoundException when data does not exist', async () => {
      const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING#DATA1' }

      dataService.getItem.mockResolvedValue(null)

      await expect(service.getDetail(key)).rejects.toThrow(NotFoundException)
    })
  })

  describe('createSetting', () => {
    it('should create setting with auto-generated sequence', async () => {
      const createDto: MasterDataCreateDto = {
        settingCode: 'SETTING_CODE',
        name: 'Test Setting',
        attributes: { key: 'value' },
      }

      prismaService.master.aggregate.mockResolvedValue({
        _max: { seq: 5 },
      })

      dataService.getItem.mockResolvedValue(null)
      const mockCommandResult: CommandModel = {
        id: 'generated-id',
        pk: `MASTER#${mockUserContext.tenantCode}`,
        sk: `${createDto.settingCode}#generated-ulid`,
        version: 1,
        type: 'MASTER',
        tenantCode: mockUserContext.tenantCode,
        code: 'generated-ulid',
        name: createDto.name,
        seq: 6,
        attributes: createDto.attributes,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      commandService.publishAsync.mockResolvedValue(mockCommandResult)

      const result = await service.createSetting(createDto, mockInvokeContext)

      expect(result).toBeInstanceOf(MasterDataEntity)
      expect(prismaService.master.aggregate).toHaveBeenCalledWith({
        _max: { seq: true },
        where: {
          tenantCode: mockUserContext.tenantCode,
          masterType: 'MASTER_DATA',
          masterTypeCode: createDto.settingCode,
        },
      })
      expect(createDto.attributes['seq']).toBe(6)
    })

    it('should create setting with provided sequence', async () => {
      const createDto: MasterDataCreateDto = {
        settingCode: 'SETTING_CODE',
        name: 'Test Setting',
        seq: 10,
        attributes: { key: 'value' },
      }

      dataService.getItem.mockResolvedValue(null)
      const mockCommandResult: CommandModel = {
        id: 'generated-id',
        pk: `MASTER#${mockUserContext.tenantCode}`,
        sk: `${createDto.settingCode}#generated-ulid`,
        version: 1,
        type: 'MASTER',
        tenantCode: mockUserContext.tenantCode,
        code: 'generated-ulid',
        name: createDto.name,
        seq: 10,
        attributes: createDto.attributes,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      commandService.publishAsync.mockResolvedValue(mockCommandResult)

      const result = await service.createSetting(createDto, mockInvokeContext)

      expect(result).toBeInstanceOf(MasterDataEntity)
      expect(prismaService.master.aggregate).not.toHaveBeenCalled()
    })

    it('should handle first sequence when no existing data', async () => {
      const createDto: MasterDataCreateDto = {
        settingCode: 'SETTING_CODE',
        name: 'Test Setting',
        attributes: { key: 'value' },
      }

      prismaService.master.aggregate.mockResolvedValue({
        _max: { seq: null },
      })

      dataService.getItem.mockResolvedValue(null)
      const mockCommandResult: CommandModel = {
        id: 'generated-id',
        pk: `MASTER#${mockUserContext.tenantCode}`,
        sk: `${createDto.settingCode}#generated-ulid`,
        version: 1,
        type: 'MASTER',
        tenantCode: mockUserContext.tenantCode,
        code: 'generated-ulid',
        name: createDto.name,
        seq: 1,
        attributes: createDto.attributes,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      commandService.publishAsync.mockResolvedValue(mockCommandResult)

      await service.createSetting(createDto, mockInvokeContext)

      expect(createDto.attributes['seq']).toBe(1)
    })
  })

  describe('updateSetting', () => {
    it('should update setting', async () => {
      const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING#DATA1' }
      const updateDto: MasterDataUpdateDto = {
        name: 'Updated Setting',
        seq: 5,
      }

      const existingData: DataModel = {
        id: 'test-id',
        pk: key.pk,
        sk: key.sk,
        code: 'DATA1',
        name: 'Original Setting',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        seq: 1,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(existingData)
      const mockUpdateResult: CommandModel = {
        ...existingData,
        name: updateDto.name!,
        seq: updateDto.seq!,
        updatedAt: new Date(),
      }
      commandService.publishPartialUpdateAsync.mockResolvedValue(mockUpdateResult)

      const result = await service.updateSetting(key, updateDto, mockInvokeContext)

      expect(result).toBeInstanceOf(MasterDataEntity)
      expect(commandService.publishPartialUpdateAsync).toHaveBeenCalledWith(
        expect.objectContaining(updateDto),
        { invokeContext: mockInvokeContext }
      )
    })
  })

  describe('deleteSetting', () => {
    it('should delete setting', async () => {
      const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING#DATA1' }
      const existingData: DataModel = {
        id: 'test-id',
        pk: key.pk,
        sk: key.sk,
        code: 'DATA1',
        name: 'Test Data',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(existingData)
      const mockDeleteResult: CommandModel = {
        ...existingData,
        isDeleted: true,
        updatedAt: new Date(),
      }
      commandService.publishPartialUpdateAsync.mockResolvedValue(mockDeleteResult)

      const result = await service.deleteSetting(key, mockInvokeContext)

      expect(result).toBeInstanceOf(MasterDataEntity)
      expect(commandService.publishPartialUpdateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          ...existingData,
          isDeleted: true,
        }),
        { invokeContext: mockInvokeContext }
      )
    })
  })

  /**
   * Test Overview: Tests comprehensive error handling scenarios for MasterDataService operations
   * Purpose: Ensures the service properly handles database failures, validation errors, and edge cases
   * Details: Verifies error handling for Prisma failures, CommandService errors, and concurrent operations
   */
  describe('Error Handling Scenarios', () => {
    describe('create - Database Error Handling', () => {
      it('should handle Prisma database connection errors gracefully', async () => {
        const createDto: CreateMasterDataDto = {
          settingCode: 'SETTING_CODE',
          code: 'DATA_CODE',
          tenantCode: 'TEST_TENANT',
          name: 'Test Data',
          seq: 1,
        }

        const dbError = new Error('Database connection failed')
        dbError.name = 'PrismaClientKnownRequestError'
        dataService.getItem.mockRejectedValue(dbError)

        await expect(service.create(createDto, { invokeContext: mockInvokeContext }))
          .rejects.toThrow('Database connection failed')
        expect(commandService.publishAsync).not.toHaveBeenCalled()
      })

      it('should handle CommandService publish failures', async () => {
        const createDto: CreateMasterDataDto = {
          settingCode: 'SETTING_CODE',
          code: 'DATA_CODE',
          tenantCode: 'TEST_TENANT',
          name: 'Test Data',
          seq: 1,
        }

        dataService.getItem.mockResolvedValue(null)
        const commandError = new Error('Command publish failed')
        commandService.publishAsync.mockRejectedValue(commandError)

        await expect(service.create(createDto, { invokeContext: mockInvokeContext }))
          .rejects.toThrow('Command publish failed')
      })

      it('should handle concurrent creation attempts with version conflicts', async () => {
        const createDto: CreateMasterDataDto = {
          settingCode: 'SETTING_CODE',
          code: 'DATA_CODE',
          tenantCode: 'TEST_TENANT',
          name: 'Test Data',
          seq: 1,
        }

        dataService.getItem.mockResolvedValue(null)
        const versionError = new Error('Version conflict')
        versionError.name = 'ConditionalCheckFailedException'
        commandService.publishAsync.mockRejectedValue(versionError)

        await expect(service.create(createDto, { invokeContext: mockInvokeContext }))
          .rejects.toThrow('Version conflict')
      })
    })

    describe('update - Error Handling', () => {
      it('should handle Prisma query timeout errors', async () => {
        const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING#DATA1' }
        const updateDto: UpdateDataSettingDto = {
          name: 'Updated Name',
          seq: 2,
        }

        const timeoutError = new Error('Query timeout')
        timeoutError.name = 'PrismaClientKnownRequestError'
        dataService.getItem.mockRejectedValue(timeoutError)

        await expect(service.update(key, updateDto, { invokeContext: mockInvokeContext }))
          .rejects.toThrow('Query timeout')
        expect(commandService.publishPartialUpdateAsync).not.toHaveBeenCalled()
      })

      it('should handle CommandService partial update failures', async () => {
        const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING#DATA1' }
        const updateDto: UpdateDataSettingDto = {
          name: 'Updated Name',
          seq: 2,
        }

        const existingData: DataModel = {
          id: 'test-id',
          pk: 'MASTER#TEST_TENANT',
          sk: 'SETTING#DATA1',
          code: 'DATA1',
          name: 'Original Name',
          version: 1,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        dataService.getItem.mockResolvedValue(existingData)
        const updateError = new Error('Update command failed')
        commandService.publishPartialUpdateAsync.mockRejectedValue(updateError)

        await expect(service.update(key, updateDto, { invokeContext: mockInvokeContext }))
          .rejects.toThrow('Update command failed')
      })
    })

    describe('delete - Error Handling', () => {
      it('should handle database access errors during deletion', async () => {
        const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING#DATA1' }

        const accessError = new Error('Access denied')
        accessError.name = 'PrismaClientKnownRequestError'
        dataService.getItem.mockRejectedValue(accessError)

        await expect(service.delete(key, { invokeContext: mockInvokeContext }))
          .rejects.toThrow('Access denied')
        expect(commandService.publishPartialUpdateAsync).not.toHaveBeenCalled()
      })

      it('should handle deletion command failures', async () => {
        const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING#DATA1' }
        const existingData: DataModel = {
          id: 'test-id',
          pk: 'MASTER#TEST_TENANT',
          sk: 'SETTING#DATA1',
          code: 'DATA1',
          name: 'Test Data',
          version: 1,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        dataService.getItem.mockResolvedValue(existingData)
        const deleteError = new Error('Delete command failed')
        commandService.publishPartialUpdateAsync.mockRejectedValue(deleteError)

        await expect(service.delete(key, { invokeContext: mockInvokeContext }))
          .rejects.toThrow('Delete command failed')
      })
    })
  })

  /**
   * Test Overview: Tests edge cases and boundary conditions for MasterDataService operations
   * Purpose: Ensures the service handles unusual inputs and boundary conditions properly
   * Details: Verifies behavior with empty values, special characters, and extreme data sizes
   */
  describe('Edge Cases and Boundary Conditions', () => {
    describe('create - Edge Cases', () => {
      it('should handle empty string values in create data', async () => {
        const createDto: CreateMasterDataDto = {
          settingCode: '',
          code: '',
          tenantCode: 'TEST_TENANT',
          name: '',
          seq: 0,
          attributes: {},
        }

        dataService.getItem.mockResolvedValue(null)
        const mockCommandResult: CommandModel = {
          id: 'MASTER#TEST_TENANT##',
          pk: 'MASTER#TEST_TENANT',
          sk: '#',
          version: 1,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          name: '',
          code: '',
          seq: 0,
          attributes: {},
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        commandService.publishAsync.mockResolvedValue(mockCommandResult)

        const result = await service.create(createDto, { invokeContext: mockInvokeContext })

        expect(result).toBeInstanceOf(MasterDataEntity)
        expect(result.name).toBe('')
        expect(result.code).toBe('')
      })

      it('should handle special characters in master data fields', async () => {
        const createDto: CreateMasterDataDto = {
          settingCode: 'SETTING_CODE',
          code: 'DATA_CODE_特殊文字@#$%',
          tenantCode: 'TEST_TENANT',
          name: 'Test Data with 特殊文字 & symbols!',
          seq: 1,
          attributes: { 
            specialKey: 'value with 特殊文字',
            unicodeKey: '🚀🎉',
            jsonString: '{"nested": "value"}' 
          },
        }

        dataService.getItem.mockResolvedValue(null)
        const mockCommandResult: CommandModel = {
          id: 'MASTER#TEST_TENANT#SETTING_CODE#DATA_CODE_特殊文字@#$%',
          pk: 'MASTER#TEST_TENANT',
          sk: 'SETTING_CODE#DATA_CODE_特殊文字@#$%',
          version: 1,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          name: createDto.name,
          code: createDto.code,
          seq: createDto.seq,
          attributes: createDto.attributes,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        commandService.publishAsync.mockResolvedValue(mockCommandResult)

        const result = await service.create(createDto, { invokeContext: mockInvokeContext })

        expect(result).toBeInstanceOf(MasterDataEntity)
        expect(result.code).toBe('DATA_CODE_特殊文字@#$%')
        expect(result.name).toBe('Test Data with 特殊文字 & symbols!')
      })

      it('should handle large attribute objects', async () => {
        const largeAttributes = {}
        for (let i = 0; i < 100; i++) {
          largeAttributes[`key${i}`] = `value${i}`.repeat(100)
        }

        const createDto: CreateMasterDataDto = {
          settingCode: 'SETTING_CODE',
          code: 'DATA_CODE',
          tenantCode: 'TEST_TENANT',
          name: 'Test Data',
          seq: 1,
          attributes: largeAttributes,
        }

        dataService.getItem.mockResolvedValue(null)
        const mockCommandResult: CommandModel = {
          id: 'MASTER#TEST_TENANT#SETTING_CODE#DATA_CODE',
          pk: 'MASTER#TEST_TENANT',
          sk: 'SETTING_CODE#DATA_CODE',
          version: 1,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          name: createDto.name,
          code: createDto.code,
          seq: createDto.seq,
          attributes: largeAttributes,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        commandService.publishAsync.mockResolvedValue(mockCommandResult)

        const result = await service.create(createDto, { invokeContext: mockInvokeContext })

        expect(result).toBeInstanceOf(MasterDataEntity)
        expect(Object.keys(result.attributes)).toHaveLength(100)
      })

      it('should handle negative sequence numbers', async () => {
        const createDto: CreateMasterDataDto = {
          settingCode: 'SETTING_CODE',
          code: 'DATA_CODE',
          tenantCode: 'TEST_TENANT',
          name: 'Test Data',
          seq: -1,
        }

        dataService.getItem.mockResolvedValue(null)
        const mockCommandResult: CommandModel = {
          id: 'MASTER#TEST_TENANT#SETTING_CODE#DATA_CODE',
          pk: 'MASTER#TEST_TENANT',
          sk: 'SETTING_CODE#DATA_CODE',
          version: 1,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          name: createDto.name,
          code: createDto.code,
          seq: -1,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        commandService.publishAsync.mockResolvedValue(mockCommandResult)

        const result = await service.create(createDto, { invokeContext: mockInvokeContext })

        expect(result).toBeInstanceOf(MasterDataEntity)
        expect(result.seq).toBe(-1)
      })
    })

    describe('update - Edge Cases', () => {
      it('should handle updates with null attributes', async () => {
        const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING#DATA1' }
        const updateDto: UpdateDataSettingDto = {
          name: 'Updated Name',
          attributes: null,
        }

        const existingData: DataModel = {
          id: 'test-id',
          pk: 'MASTER#TEST_TENANT',
          sk: 'SETTING#DATA1',
          code: 'DATA1',
          name: 'Original Name',
          version: 1,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          isDeleted: false,
          attributes: { original: true },
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        dataService.getItem.mockResolvedValue(existingData)
        const mockUpdateResult: CommandModel = {
          ...existingData,
          name: updateDto.name,
          attributes: null,
          updatedAt: new Date(),
        }
        commandService.publishPartialUpdateAsync.mockResolvedValue(mockUpdateResult)

        const result = await service.update(key, updateDto, { invokeContext: mockInvokeContext })

        expect(result).toBeInstanceOf(MasterDataEntity)
        expect(result.attributes).toBeNull()
      })

      it('should handle extremely long name values', async () => {
        const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING#DATA1' }
        const longName = 'A'.repeat(1000)
        const updateDto: UpdateDataSettingDto = {
          name: longName,
        }

        const existingData: DataModel = {
          id: 'test-id',
          pk: 'MASTER#TEST_TENANT',
          sk: 'SETTING#DATA1',
          code: 'DATA1',
          name: 'Original Name',
          version: 1,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        dataService.getItem.mockResolvedValue(existingData)
        const mockUpdateResult: CommandModel = {
          ...existingData,
          name: longName,
          updatedAt: new Date(),
        }
        commandService.publishPartialUpdateAsync.mockResolvedValue(mockUpdateResult)

        const result = await service.update(key, updateDto, { invokeContext: mockInvokeContext })

        expect(result).toBeInstanceOf(MasterDataEntity)
        expect(result.name).toBe(longName)
        expect(result.name.length).toBe(1000)
      })
    })
  })

  /**
   * Test Overview: Tests deleted data re-addition scenarios for MasterDataService
   * Purpose: Ensures deleted master data can be properly recreated with correct version handling
   * Details: Verifies version increment, attribute preservation, and state transitions from deleted to active
   */
  describe('Deleted Data Re-addition Scenarios', () => {
    describe('create - Deleted Data Recreation', () => {
      it('should recreate deleted data with incremented version', async () => {
        const createDto: CreateMasterDataDto = {
          settingCode: 'SETTING_CODE',
          code: 'DATA_CODE',
          tenantCode: 'TEST_TENANT',
          name: 'Recreated Data',
          seq: 2,
          attributes: { recreated: true },
        }

        const existingDeletedData: DataModel = {
          id: 'existing-id',
          pk: 'MASTER#TEST_TENANT',
          sk: 'SETTING_CODE#DATA_CODE',
          code: 'DATA_CODE',
          name: 'Original Data',
          version: 3,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          isDeleted: true,
          attributes: { original: true },
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-02'),
        }

        dataService.getItem.mockResolvedValue(existingDeletedData)
        const mockCommandResult: CommandModel = {
          id: 'MASTER#TEST_TENANT#SETTING_CODE#DATA_CODE',
          pk: 'MASTER#TEST_TENANT',
          sk: 'SETTING_CODE#DATA_CODE',
          version: 3,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          name: createDto.name,
          code: createDto.code,
          seq: createDto.seq,
          attributes: createDto.attributes,
          isDeleted: false,
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date(),
        }
        commandService.publishAsync.mockResolvedValue(mockCommandResult)

        const result = await service.create(createDto, { invokeContext: mockInvokeContext })

        expect(result).toBeInstanceOf(MasterDataEntity)
        expect(result.version).toBe(3)
        expect(result.isDeleted).toBe(false)
        expect(result.name).toBe('Recreated Data')
        expect(result.attributes).toEqual({ recreated: true })
        expect(commandService.publishAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            version: 3,
            isDeleted: false,
            name: 'Recreated Data',
            attributes: { recreated: true },
          }),
          { invokeContext: mockInvokeContext }
        )
      })

      it('should handle multiple deletion and recreation cycles', async () => {
        const createDto: CreateMasterDataDto = {
          settingCode: 'SETTING_CODE',
          code: 'DATA_CODE',
          tenantCode: 'TEST_TENANT',
          name: 'Third Recreation',
          seq: 1,
          attributes: { cycle: 3 },
        }

        const existingDeletedData: DataModel = {
          id: 'existing-id',
          pk: 'MASTER#TEST_TENANT',
          sk: 'SETTING_CODE#DATA_CODE',
          code: 'DATA_CODE',
          name: 'Second Recreation',
          version: 5,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          isDeleted: true,
          attributes: { cycle: 2 },
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-03'),
        }

        dataService.getItem.mockResolvedValue(existingDeletedData)
        const mockCommandResult: CommandModel = {
          id: 'MASTER#TEST_TENANT#SETTING_CODE#DATA_CODE',
          pk: 'MASTER#TEST_TENANT',
          sk: 'SETTING_CODE#DATA_CODE',
          version: 5,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          name: createDto.name,
          code: createDto.code,
          seq: createDto.seq,
          attributes: createDto.attributes,
          isDeleted: false,
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date(),
        }
        commandService.publishAsync.mockResolvedValue(mockCommandResult)

        const result = await service.create(createDto, { invokeContext: mockInvokeContext })

        expect(result).toBeInstanceOf(MasterDataEntity)
        expect(result.version).toBe(5)
        expect(result.isDeleted).toBe(false)
        expect(result.attributes).toEqual({ cycle: 3 })
      })

      it('should preserve original creation timestamp when recreating deleted data', async () => {
        const originalCreatedAt = new Date('2023-01-01T10:00:00Z')
        const createDto: CreateMasterDataDto = {
          settingCode: 'SETTING_CODE',
          code: 'DATA_CODE',
          tenantCode: 'TEST_TENANT',
          name: 'Recreated Data',
          seq: 1,
        }

        const existingDeletedData: DataModel = {
          id: 'existing-id',
          pk: 'MASTER#TEST_TENANT',
          sk: 'SETTING_CODE#DATA_CODE',
          code: 'DATA_CODE',
          name: 'Original Data',
          version: 2,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          isDeleted: true,
          createdAt: originalCreatedAt,
          updatedAt: new Date('2023-01-02'),
        }

        dataService.getItem.mockResolvedValue(existingDeletedData)
        const mockCommandResult: CommandModel = {
          id: 'MASTER#TEST_TENANT#SETTING_CODE#DATA_CODE',
          pk: 'MASTER#TEST_TENANT',
          sk: 'SETTING_CODE#DATA_CODE',
          version: 2,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          name: createDto.name,
          code: createDto.code,
          seq: createDto.seq,
          isDeleted: false,
          createdAt: originalCreatedAt,
          updatedAt: new Date(),
        }
        commandService.publishAsync.mockResolvedValue(mockCommandResult)

        const result = await service.create(createDto, { invokeContext: mockInvokeContext })

        expect(result).toBeInstanceOf(MasterDataEntity)
        expect(result.createdAt).toEqual(originalCreatedAt)
        expect(result.isDeleted).toBe(false)
      })

      it('should handle recreation with different tenant codes', async () => {
        const createDto: CreateMasterDataDto = {
          settingCode: 'SETTING_CODE',
          code: 'DATA_CODE',
          tenantCode: 'NEW_TENANT',
          name: 'Recreated Data',
          seq: 1,
        }

        dataService.getItem.mockResolvedValue(null)
        const mockCommandResult: CommandModel = {
          id: 'MASTER#NEW_TENANT#SETTING_CODE#DATA_CODE',
          pk: 'MASTER#NEW_TENANT',
          sk: 'SETTING_CODE#DATA_CODE',
          version: 1,
          type: 'MASTER',
          tenantCode: 'NEW_TENANT',
          name: createDto.name,
          code: createDto.code,
          seq: createDto.seq,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        commandService.publishAsync.mockResolvedValue(mockCommandResult)

        const result = await service.create(createDto, { invokeContext: mockInvokeContext })

        expect(result).toBeInstanceOf(MasterDataEntity)
        expect(result.tenantCode).toBe('NEW_TENANT')
        expect(result.version).toBe(1)
      })
    })

    describe('checkExistCode - Deleted Data Scenarios', () => {
      it('should return false for deleted data when checking existence', async () => {
        const mockDeletedData: DataModel = {
          id: 'test-id',
          pk: 'MASTER#TEST_TENANT',
          sk: 'SETTING_CODE#DATA_CODE',
          code: 'DATA_CODE',
          name: 'Deleted Data',
          version: 2,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          isDeleted: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        dataService.getItem.mockResolvedValue(mockDeletedData)

        const result = await service.checkExistCode('TEST_TENANT', 'SETTING_CODE', 'DATA_CODE')

        expect(result).toBe(false)
        expect(dataService.getItem).toHaveBeenCalledWith({
          pk: 'MASTER#TEST_TENANT',
          sk: 'SETTING_CODE#DATA_CODE',
        })
      })

      it('should handle null data when checking existence', async () => {
        dataService.getItem.mockResolvedValue(null)

        const result = await service.checkExistCode('TEST_TENANT', 'SETTING_CODE', 'NONEXISTENT_CODE')

        expect(result).toBe(false)
      })
    })
  })

  /**
   * Test Overview: Tests concurrent operation scenarios for MasterDataService
   * Purpose: Ensures the service handles simultaneous operations correctly with proper version control
   * Details: Verifies race condition handling, version conflicts, and concurrent CRUD operations
   */
  describe('Concurrent Operation Scenarios', () => {
    describe('create - Concurrent Operations', () => {
      it('should handle concurrent creation attempts correctly', async () => {
        const createDto1: CreateMasterDataDto = {
          settingCode: 'SETTING_CODE',
          code: 'DATA_CODE',
          tenantCode: 'TEST_TENANT',
          name: 'First Creation',
          seq: 1,
        }

        const createDto2: CreateMasterDataDto = {
          settingCode: 'SETTING_CODE',
          code: 'DATA_CODE',
          tenantCode: 'TEST_TENANT',
          name: 'Second Creation',
          seq: 2,
        }

        dataService.getItem.mockResolvedValue(null)
        
        const mockCommandResult1: CommandModel = {
          id: 'MASTER#TEST_TENANT#SETTING_CODE#DATA_CODE',
          pk: 'MASTER#TEST_TENANT',
          sk: 'SETTING_CODE#DATA_CODE',
          version: 1,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          name: createDto1.name,
          code: createDto1.code,
          seq: createDto1.seq,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        const versionConflictError = new Error('Version conflict')
        versionConflictError.name = 'ConditionalCheckFailedException'

        commandService.publishAsync
          .mockResolvedValueOnce(mockCommandResult1)
          .mockRejectedValueOnce(versionConflictError)

        const result1 = await service.create(createDto1, { invokeContext: mockInvokeContext })
        
        await expect(service.create(createDto2, { invokeContext: mockInvokeContext }))
          .rejects.toThrow('Version conflict')

        expect(result1).toBeInstanceOf(MasterDataEntity)
        expect(result1.name).toBe('First Creation')
      })

      it('should handle concurrent deletion and recreation', async () => {
        const createDto: CreateMasterDataDto = {
          settingCode: 'SETTING_CODE',
          code: 'DATA_CODE',
          tenantCode: 'TEST_TENANT',
          name: 'Recreated Data',
          seq: 1,
        }

        const existingData: DataModel = {
          id: 'existing-id',
          pk: 'MASTER#TEST_TENANT',
          sk: 'SETTING_CODE#DATA_CODE',
          code: 'DATA_CODE',
          name: 'Original Data',
          version: 2,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        const deletedData: DataModel = {
          ...existingData,
          isDeleted: true,
          version: 3,
        }

        dataService.getItem
          .mockResolvedValueOnce(existingData)
          .mockResolvedValueOnce(deletedData)

        const mockDeleteResult: CommandModel = {
          ...existingData,
          isDeleted: true,
          version: 3,
          updatedAt: new Date(),
        }

        const mockRecreateResult: CommandModel = {
          ...deletedData,
          name: createDto.name,
          isDeleted: false,
          version: 3,
          updatedAt: new Date(),
        }

        commandService.publishPartialUpdateAsync.mockResolvedValue(mockDeleteResult)
        commandService.publishAsync.mockResolvedValue(mockRecreateResult)

        const deleteResult = await service.delete(
          { pk: existingData.pk, sk: existingData.sk },
          { invokeContext: mockInvokeContext }
        )
        
        const recreateResult = await service.create(createDto, { invokeContext: mockInvokeContext })

        expect(deleteResult.isDeleted).toBe(true)
        expect(recreateResult.isDeleted).toBe(false)
        expect(recreateResult.version).toBe(3)
      })
    })

    describe('update - Concurrent Operations', () => {
      it('should handle concurrent update attempts with version conflicts', async () => {
        const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING#DATA1' }
        const updateDto1: UpdateDataSettingDto = {
          name: 'First Update',
          seq: 1,
        }
        const updateDto2: UpdateDataSettingDto = {
          name: 'Second Update',
          seq: 2,
        }

        const existingData: DataModel = {
          id: 'test-id',
          pk: 'MASTER#TEST_TENANT',
          sk: 'SETTING#DATA1',
          code: 'DATA1',
          name: 'Original Name',
          version: 1,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        dataService.getItem.mockResolvedValue(existingData)

        const mockUpdateResult1: CommandModel = {
          ...existingData,
          name: updateDto1.name,
          seq: updateDto1.seq,
          version: 2,
          updatedAt: new Date(),
        }

        const versionConflictError = new Error('Version conflict')
        versionConflictError.name = 'ConditionalCheckFailedException'

        commandService.publishPartialUpdateAsync
          .mockResolvedValueOnce(mockUpdateResult1)
          .mockRejectedValueOnce(versionConflictError)

        const result1 = await service.update(key, updateDto1, { invokeContext: mockInvokeContext })
        
        await expect(service.update(key, updateDto2, { invokeContext: mockInvokeContext }))
          .rejects.toThrow('Version conflict')

        expect(result1.name).toBe('First Update')
        expect(result1.version).toBe(2)
      })
    })
  })
})
