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
})
