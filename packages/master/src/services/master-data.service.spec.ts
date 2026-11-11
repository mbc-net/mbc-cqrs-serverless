import { Test, TestingModule } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'
import { MasterAccessService } from '../access/master-access.service'
import { MasterAccessResolverRegistry } from '../access/master-access-resolver.registry'
import { MasterDataService } from './master-data.service'
import {
  CommandService,
  DataService,
  getUserContext,
  UserContext,
  DataModel,
  CommandModel,
  DataListEntity,
  DataEntity,
} from '@mbc-cqrs-serverless/core'
import {
  MODULE_OPTIONS_TOKEN,
  PRISMA_SERVICE,
} from '../master.module-definition'
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
    tenantRoles: ['ADMIN'],
    tenantGroupIds: [],
  }

  const mockInvokeContext = {
    context: { awsRequestId: 'test-request-id' },
    event: { requestContext: { http: { sourceIp: '127.0.0.1' } } },
  }

  beforeEach(async () => {
    const mockPrismaService = {
      _activeProvider: 'postgresql',
      master: {
        findMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
    }

    mockGetUserContext = getUserContext as jest.MockedFunction<
      typeof getUserContext
    >
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

  describe('listByRds search filters per database', () => {
    const search = async () => {
      prismaService.master.findMany.mockResolvedValue([])
      prismaService.master.count.mockResolvedValue(0)
      await service.listByRds(
        { keyword: 'Area', code: 'Ar', pageSize: 10, page: 1 },
        { invokeContext: mockInvokeContext },
      )
      return JSON.stringify(prismaService.master.findMany.mock.calls)
    }

    it('matches case-insensitively with mode on postgresql', async () => {
      const calls = await search()
      expect(calls).toContain(
        '{"name":{"contains":"Area","mode":"insensitive"}}',
      )
      expect(calls).toContain(
        '{"masterCode":{"contains":"Ar","mode":"insensitive"}}',
      )
    })

    it('drops mode on mysql', async () => {
      prismaService._activeProvider = 'mysql'
      const calls = await search()
      expect(calls).toContain('{"name":{"contains":"Area"}}')
      expect(calls).toContain('{"masterCode":{"contains":"Ar"}}')
      expect(calls).not.toContain('insensitive')
    })
  })

  describe('listByRds includeCommon', () => {
    const dto = (extra: any = {}) => ({ pageSize: 10, page: 1, ...extra })
    const list = (extra: any = {}) =>
      service.listByRds(dto(extra), { invokeContext: mockInvokeContext })
    const countWhere = () => prismaService.master.count.mock.calls[0][0].where

    beforeEach(() => {
      prismaService.master.count.mockResolvedValue(0)
    })

    it('returns only the caller tenant by default', async () => {
      prismaService.master.findMany.mockResolvedValue([])
      await list()
      expect(countWhere().tenantCode).toBe('TEST_TENANT')
      expect(countWhere().OR).toBeUndefined()
      expect(prismaService.master.findMany).toHaveBeenCalledTimes(2)
    })

    it('merges common rows when includeCommon is true', async () => {
      prismaService.master.findMany.mockResolvedValue([])
      await list({ includeCommon: true })
      expect(countWhere().OR).toEqual([
        { tenantCode: 'TEST_TENANT' },
        { tenantCode: 'common', code: { notIn: [] } },
      ])
      expect(countWhere().tenantCode).toBeUndefined()
    })

    it('excludes codes the tenant has, including soft-deleted', async () => {
      prismaService.master.findMany
        .mockResolvedValueOnce([]) // deleted settings
        .mockResolvedValueOnce([{ code: 'MASTER#S#A' }]) // own codes
        .mockResolvedValue([])
      await list({ includeCommon: true, settingCode: ' S ' })
      const own = prismaService.master.findMany.mock.calls[1][0]
      expect(own.where).toEqual({
        tenantCode: 'TEST_TENANT',
        masterType: 'MASTER_DATA',
        masterTypeCode: 'S',
      })
      expect(own.where.isDeleted).toBeUndefined()
      expect(countWhere().OR[1].code).toEqual({ notIn: ['MASTER#S#A'] })
    })

    it('does not query exclusions when the caller is in the common tenant', async () => {
      mockGetUserContext.mockReturnValue({
        ...mockUserContext,
        tenantCode: 'COMMON',
      })
      prismaService.master.findMany.mockResolvedValue([])
      await list({ includeCommon: true })
      expect(prismaService.master.findMany).toHaveBeenCalledTimes(2)
      expect(countWhere().tenantCode).toBe('COMMON')
      expect(
        prismaService.master.findMany.mock.calls[0][0].where.tenantCode,
      ).toBe('COMMON')
    })

    it('hides common rows, not tenant rows, of a setting deleted in common', async () => {
      prismaService.master.findMany
        .mockResolvedValueOnce([{ masterCode: 'GONE', tenantCode: 'common' }])
        .mockResolvedValue([])
      await list({ includeCommon: true })
      expect(
        prismaService.master.findMany.mock.calls[0][0].where.tenantCode,
      ).toEqual({ in: ['TEST_TENANT', 'common'] })
      expect(countWhere().masterTypeCode).toBeUndefined()
      expect(countWhere().OR).toEqual([
        { tenantCode: 'TEST_TENANT' },
        {
          tenantCode: 'common',
          code: { notIn: [] },
          masterTypeCode: { notIn: ['GONE'] },
        },
      ])
    })

    it('hides tenant rows of a setting deleted in the tenant', async () => {
      prismaService.master.findMany
        .mockResolvedValueOnce([
          { masterCode: 'MINE', tenantCode: 'TEST_TENANT' },
        ])
        .mockResolvedValue([])
      await list({ includeCommon: true })
      expect(countWhere().OR).toEqual([
        { tenantCode: 'TEST_TENANT', masterTypeCode: { notIn: ['MINE'] } },
        { tenantCode: 'common', code: { notIn: [] } },
      ])
    })

    it('keeps the where clause as before without includeCommon', async () => {
      prismaService.master.findMany
        .mockResolvedValueOnce([{ masterCode: 'GONE' }])
        .mockResolvedValue([])
      await list()
      expect(prismaService.master.findMany.mock.calls[0][0].where).toEqual({
        tenantCode: 'TEST_TENANT',
        isDeleted: true,
        masterType: 'MASTER_SETTING',
      })
      expect(countWhere()).toEqual({
        tenantCode: 'TEST_TENANT',
        masterType: 'MASTER_DATA',
        masterTypeCode: { notIn: ['GONE'] },
        isDeleted: false,
      })
    })
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

      const result = await service.listByRds(searchDto, {
        invokeContext: mockInvokeContext,
      })

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

      const result = await service.listByRds(searchDto, {
        invokeContext: mockInvokeContext,
      })

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
        }),
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
            skExpression: 'begins_with(sk, :settingCode)',
            skAttributeValues: {
              ':settingCode': 'SETTING_CODE#',
            },
          }),
        }),
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
        'MASTER#common',
        expect.any(Object),
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

      const result = await service.create(createDto, {
        invokeContext: mockInvokeContext,
      })

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
        { invokeContext: mockInvokeContext },
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

      await expect(
        service.create(createDto, { invokeContext: mockInvokeContext }),
      ).rejects.toThrow('Master data already exists')
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

      const result = await service.create(createDto, {
        invokeContext: mockInvokeContext,
      })

      expect(result).toBeInstanceOf(MasterDataEntity)
      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 2,
        }),
        { invokeContext: mockInvokeContext },
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
      commandService.publishPartialUpdateAsync.mockResolvedValue(
        mockUpdateResult,
      )

      const result = await service.update(key, updateDto, {
        invokeContext: mockInvokeContext,
      })

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
        { invokeContext: mockInvokeContext },
      )
    })

    it('should throw NotFoundException when data does not exist', async () => {
      const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING#DATA1' }
      const updateDto: UpdateDataSettingDto = {
        name: 'Updated Name',
      }

      dataService.getItem.mockResolvedValue(null)

      await expect(
        service.update(key, updateDto, { invokeContext: mockInvokeContext }),
      ).rejects.toThrow('Master data not found')
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
      commandService.publishPartialUpdateAsync.mockResolvedValue(
        mockUpdateResult,
      )

      await service.update(key, updateDto, { invokeContext: mockInvokeContext })

      expect(commandService.publishPartialUpdateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: existingData.name,
          seq: updateDto.seq,
          isDeleted: existingData.isDeleted,
          attributes: existingData.attributes,
        }),
        { invokeContext: mockInvokeContext },
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
      commandService.publishPartialUpdateAsync.mockResolvedValue(
        mockDeleteResult,
      )

      const result = await service.delete(key, {
        invokeContext: mockInvokeContext,
      })

      expect(result).toBeInstanceOf(MasterDataEntity)
      expect(commandService.publishPartialUpdateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          ...existingData,
          isDeleted: true,
        }),
        { invokeContext: mockInvokeContext },
      )
    })

    it('should throw NotFoundException when data does not exist', async () => {
      const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING#DATA1' }

      dataService.getItem.mockResolvedValue(null)

      await expect(
        service.delete(key, { invokeContext: mockInvokeContext }),
      ).rejects.toThrow('Master data not found')
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

      await expect(
        service.delete(key, { invokeContext: mockInvokeContext }),
      ).rejects.toThrow('This master data is already deleted')
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

      const result = await service.checkExistCode(
        'TEST_TENANT',
        'SETTING_TYPE',
        'CODE1',
      )

      expect(result).toBe(true)
      expect(dataService.getItem).toHaveBeenCalledWith({
        pk: 'MASTER#TEST_TENANT',
        sk: 'SETTING_TYPE#CODE1',
      })
    })

    it('should return false when code does not exist', async () => {
      dataService.getItem.mockResolvedValue(null)

      const result = await service.checkExistCode(
        'TEST_TENANT',
        'SETTING_TYPE',
        'CODE1',
      )

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

      const result = await service.checkExistCode(
        'TEST_TENANT',
        'SETTING_TYPE',
        'CODE1',
      )

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

      await expect(service.getDetail(key)).rejects.toThrow(
        'Master data not found',
      )
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
      // Verify seq is passed to publishAsync without mutating the original DTO
      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.objectContaining({ seq: 6 }),
          seq: 6,
        }),
        expect.anything(),
      )
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

      // Verify seq is passed to publishAsync without mutating the original DTO
      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.objectContaining({ seq: 1 }),
          seq: 1,
        }),
        expect.anything(),
      )
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
      commandService.publishPartialUpdateAsync.mockResolvedValue(
        mockUpdateResult,
      )

      const result = await service.updateSetting(
        key,
        updateDto,
        mockInvokeContext,
      )

      expect(result).toBeInstanceOf(MasterDataEntity)
      expect(commandService.publishPartialUpdateAsync).toHaveBeenCalledWith(
        expect.objectContaining(updateDto),
        { invokeContext: mockInvokeContext },
      )
    })
  })

  describe('upsert', () => {
    it('should create new data when not exists', async () => {
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

      const result = await service.upsert(createDto, {
        invokeContext: mockInvokeContext,
      })

      expect(result).toBeInstanceOf(MasterDataEntity)
      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 0,
          isDeleted: false,
        }),
        { invokeContext: mockInvokeContext },
      )
    })

    it('should update existing data when exists with changes', async () => {
      const createDto: CreateMasterDataDto = {
        settingCode: 'SETTING_CODE',
        code: 'DATA_CODE',
        tenantCode: 'TEST_TENANT',
        name: 'Updated Data',
        seq: 2,
        attributes: { key: 'new-value' },
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
        attributes: { key: 'old-value' },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(existingData)
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
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      commandService.publishAsync.mockResolvedValue(mockCommandResult)

      const result = await service.upsert(createDto, {
        invokeContext: mockInvokeContext,
      })

      expect(result).toBeInstanceOf(MasterDataEntity)
      expect(result.name).toBe('Updated Data')
      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 2,
          isDeleted: false,
        }),
        { invokeContext: mockInvokeContext },
      )
    })

    it('should return existing data when data is identical (not dirty)', async () => {
      const createDto: CreateMasterDataDto = {
        settingCode: 'SETTING_CODE',
        code: 'DATA_CODE',
        tenantCode: 'TEST_TENANT',
        name: 'Same Data',
        seq: 1,
        attributes: { key: 'value' },
      }

      const existingData: DataModel = {
        id: 'existing-id',
        pk: 'MASTER#TEST_TENANT',
        sk: 'SETTING_CODE#DATA_CODE',
        code: 'DATA_CODE',
        name: 'Same Data',
        version: 2,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: false,
        attributes: { key: 'value' },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(existingData)
      // publishAsync returns null when not dirty
      commandService.publishAsync.mockResolvedValue(null)

      const result = await service.upsert(createDto, {
        invokeContext: mockInvokeContext,
      })

      expect(result).toBeInstanceOf(MasterDataEntity)
      expect(result.name).toBe('Same Data')
    })

    it('should recreate when existing data is deleted', async () => {
      const createDto: CreateMasterDataDto = {
        settingCode: 'SETTING_CODE',
        code: 'DATA_CODE',
        tenantCode: 'TEST_TENANT',
        name: 'Recreated Data',
        seq: 1,
        attributes: { recreated: true },
      }

      const existingDeletedData: DataModel = {
        id: 'existing-id',
        pk: 'MASTER#TEST_TENANT',
        sk: 'SETTING_CODE#DATA_CODE',
        code: 'DATA_CODE',
        name: 'Deleted Data',
        version: 3,
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
        version: 3,
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

      const result = await service.upsert(createDto, {
        invokeContext: mockInvokeContext,
      })

      expect(result).toBeInstanceOf(MasterDataEntity)
      expect(result.isDeleted).toBe(false)
      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 3,
          isDeleted: false,
        }),
        { invokeContext: mockInvokeContext },
      )
    })
  })

  describe('upsertBulk', () => {
    it('should upsert multiple items', async () => {
      const createDto1: MasterDataCreateDto = {
        settingCode: 'SETTING_CODE',
        name: 'Item 1',
        code: 'CODE1',
        seq: 1,
        attributes: { key: 'value1' },
      }
      const createDto2: MasterDataCreateDto = {
        settingCode: 'SETTING_CODE',
        name: 'Item 2',
        code: 'CODE2',
        seq: 2,
        attributes: { key: 'value2' },
      }

      prismaService.master.aggregate.mockResolvedValue({
        _max: { seq: null },
      })

      dataService.getItem.mockResolvedValue(null)
      const mockResult1: CommandModel = {
        id: 'id1',
        pk: `MASTER#${mockUserContext.tenantCode}`,
        sk: 'SETTING_CODE#CODE1',
        version: 1,
        type: 'MASTER',
        tenantCode: mockUserContext.tenantCode,
        name: 'Item 1',
        code: 'CODE1',
        seq: 1,
        attributes: { key: 'value1' },
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const mockResult2: CommandModel = {
        id: 'id2',
        pk: `MASTER#${mockUserContext.tenantCode}`,
        sk: 'SETTING_CODE#CODE2',
        version: 1,
        type: 'MASTER',
        tenantCode: mockUserContext.tenantCode,
        name: 'Item 2',
        code: 'CODE2',
        seq: 2,
        attributes: { key: 'value2' },
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      commandService.publishAsync
        .mockResolvedValueOnce(mockResult1)
        .mockResolvedValueOnce(mockResult2)

      const result = await service.upsertBulk(
        { items: [createDto1, createDto2] },
        mockInvokeContext,
      )

      expect(result).toHaveLength(2)
      expect(result[0]).toBeInstanceOf(MasterDataEntity)
      expect(result[1]).toBeInstanceOf(MasterDataEntity)
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
      commandService.publishPartialUpdateAsync.mockResolvedValue(
        mockDeleteResult,
      )

      const result = await service.deleteSetting(key, mockInvokeContext)

      expect(result).toBeInstanceOf(MasterDataEntity)
      expect(commandService.publishPartialUpdateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          ...existingData,
          isDeleted: true,
        }),
        { invokeContext: mockInvokeContext },
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

        await expect(
          service.create(createDto, { invokeContext: mockInvokeContext }),
        ).rejects.toThrow('Database connection failed')
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

        await expect(
          service.create(createDto, { invokeContext: mockInvokeContext }),
        ).rejects.toThrow('Command publish failed')
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

        await expect(
          service.create(createDto, { invokeContext: mockInvokeContext }),
        ).rejects.toThrow('Version conflict')
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

        await expect(
          service.update(key, updateDto, { invokeContext: mockInvokeContext }),
        ).rejects.toThrow('Query timeout')
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

        await expect(
          service.update(key, updateDto, { invokeContext: mockInvokeContext }),
        ).rejects.toThrow('Update command failed')
      })
    })

    describe('delete - Error Handling', () => {
      it('should handle database access errors during deletion', async () => {
        const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING#DATA1' }

        const accessError = new Error('Access denied')
        accessError.name = 'PrismaClientKnownRequestError'
        dataService.getItem.mockRejectedValue(accessError)

        await expect(
          service.delete(key, { invokeContext: mockInvokeContext }),
        ).rejects.toThrow('Access denied')
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

        await expect(
          service.delete(key, { invokeContext: mockInvokeContext }),
        ).rejects.toThrow('Delete command failed')
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

        const result = await service.create(createDto, {
          invokeContext: mockInvokeContext,
        })

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
            jsonString: '{"nested": "value"}',
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

        const result = await service.create(createDto, {
          invokeContext: mockInvokeContext,
        })

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

        const result = await service.create(createDto, {
          invokeContext: mockInvokeContext,
        })

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

        const result = await service.create(createDto, {
          invokeContext: mockInvokeContext,
        })

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
        commandService.publishPartialUpdateAsync.mockResolvedValue(
          mockUpdateResult,
        )

        const result = await service.update(key, updateDto, {
          invokeContext: mockInvokeContext,
        })

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
        commandService.publishPartialUpdateAsync.mockResolvedValue(
          mockUpdateResult,
        )

        const result = await service.update(key, updateDto, {
          invokeContext: mockInvokeContext,
        })

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

        const result = await service.create(createDto, {
          invokeContext: mockInvokeContext,
        })

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
          { invokeContext: mockInvokeContext },
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

        const result = await service.create(createDto, {
          invokeContext: mockInvokeContext,
        })

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

        const result = await service.create(createDto, {
          invokeContext: mockInvokeContext,
        })

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

        const result = await service.create(createDto, {
          invokeContext: mockInvokeContext,
        })

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

        const result = await service.checkExistCode(
          'TEST_TENANT',
          'SETTING_CODE',
          'DATA_CODE',
        )

        expect(result).toBe(false)
        expect(dataService.getItem).toHaveBeenCalledWith({
          pk: 'MASTER#TEST_TENANT',
          sk: 'SETTING_CODE#DATA_CODE',
        })
      })

      it('should handle null data when checking existence', async () => {
        dataService.getItem.mockResolvedValue(null)

        const result = await service.checkExistCode(
          'TEST_TENANT',
          'SETTING_CODE',
          'NONEXISTENT_CODE',
        )

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

        const result1 = await service.create(createDto1, {
          invokeContext: mockInvokeContext,
        })

        await expect(
          service.create(createDto2, { invokeContext: mockInvokeContext }),
        ).rejects.toThrow('Version conflict')

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

        commandService.publishPartialUpdateAsync.mockResolvedValue(
          mockDeleteResult,
        )
        commandService.publishAsync.mockResolvedValue(mockRecreateResult)

        const deleteResult = await service.delete(
          { pk: existingData.pk, sk: existingData.sk },
          { invokeContext: mockInvokeContext },
        )

        const recreateResult = await service.create(createDto, {
          invokeContext: mockInvokeContext,
        })

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

        const result1 = await service.update(key, updateDto1, {
          invokeContext: mockInvokeContext,
        })

        await expect(
          service.update(key, updateDto2, { invokeContext: mockInvokeContext }),
        ).rejects.toThrow('Version conflict')

        expect(result1.name).toBe('First Update')
        expect(result1.version).toBe(2)
      })
    })
  })
})

describe('MasterDataService commonTenantCode option', () => {
  const build = async (moduleOptions?: any) => {
    const dataService = createMock<DataService>()
    const providers: any[] = [
      MasterDataService,
      { provide: PRISMA_SERVICE, useValue: {} },
      { provide: CommandService, useValue: createMock<CommandService>() },
      { provide: DataService, useValue: dataService },
    ]
    if (moduleOptions) {
      providers.push({ provide: MODULE_OPTIONS_TOKEN, useValue: moduleOptions })
    }
    const module = await Test.createTestingModule({ providers }).compile()
    return { service: module.get(MasterDataService), dataService }
  }

  it('lists from the configured common tenant', async () => {
    const { service, dataService } = await build({
      commonTenantCode: 'shared-tenant',
    })
    dataService.listItemsByPk.mockResolvedValue({ items: [] } as any)
    await service.list({ settingCode: 'X' } as any)
    expect(dataService.listItemsByPk).toHaveBeenCalledWith(
      'MASTER#shared-tenant',
      expect.anything(),
    )
  })

  it('keeps common when the option is unset', async () => {
    process.env.COMMON_TENANT_CODES = 'other'
    try {
      const { service, dataService } = await build()
      dataService.listItemsByPk.mockResolvedValue({ items: [] } as any)
      await service.list({ settingCode: 'X' } as any)
      expect(dataService.listItemsByPk).toHaveBeenCalledWith(
        'MASTER#common',
        expect.anything(),
      )
    } finally {
      delete process.env.COMMON_TENANT_CODES
    }
  })
})

describe('MasterDataService reserved system attribute', () => {
  const invoke = {
    context: { awsRequestId: 'r' },
    event: { requestContext: { http: { sourceIp: '127.0.0.1' } } },
  } as any
  const build = async () => {
    const dataService = createMock<DataService>()
    const commandService = createMock<CommandService>()
    const prisma = {
      master: {
        findMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _max: { seq: 0 } }),
      },
    }
    const module = await Test.createTestingModule({
      providers: [
        MasterDataService,
        { provide: PRISMA_SERVICE, useValue: prisma },
        { provide: CommandService, useValue: commandService },
        { provide: DataService, useValue: dataService },
      ],
    }).compile()
    return {
      service: module.get(MasterDataService),
      dataService,
      commandService,
      prisma,
    }
  }
  const owned = () => ({ id: 'i', attributes: { a: 1, __systemId: 'S1' } })

  it('removes a client __systemId on create', async () => {
    const { service, dataService, commandService } = await build()
    dataService.getItem.mockResolvedValue(null as any)
    commandService.publishAsync.mockResolvedValue({ id: 'i' } as any)
    await service.create(
      {
        settingCode: 'S',
        code: 'C',
        tenantCode: 'T',
        name: 'n',
        attributes: { a: 1, __systemId: 'evil' },
      } as any,
      { invokeContext: invoke },
    )
    expect(commandService.publishAsync.mock.calls[0][0].attributes).toEqual({
      a: 1,
    })
  })

  it('removes a client __systemId on update', async () => {
    const { service, dataService, commandService } = await build()
    dataService.getItem.mockResolvedValue({
      id: 'i',
      attributes: { a: 1 },
    } as any)
    commandService.publishPartialUpdateAsync.mockResolvedValue({
      id: 'i',
    } as any)
    await service.update(
      { pk: 'p', sk: 's' },
      { attributes: { b: 2, __systemId: 'evil' } } as any,
      { invokeContext: invoke },
    )
    expect(
      commandService.publishPartialUpdateAsync.mock.calls[0][0].attributes,
    ).toEqual({ b: 2 })
  })

  it('removes it from data going through upsertBulk', async () => {
    const { service, dataService, commandService } = await build()
    dataService.getItem.mockResolvedValue(null as any)
    commandService.publishAsync.mockResolvedValue({ id: 'i' } as any)
    await service.upsertBulk(
      {
        items: [
          {
            settingCode: 'S',
            code: 'C',
            tenantCode: 'T',
            name: 'n',
            attributes: { __systemId: 'evil', a: 1 },
          },
        ],
      } as any,
      invoke,
    )
    expect(
      commandService.publishAsync.mock.calls[0][0].attributes,
    ).not.toHaveProperty('__systemId')
  })

  it('returns systemId at the top level from get and getDetail', async () => {
    const { service, dataService } = await build()
    dataService.getItem.mockResolvedValue(owned() as any)
    for (const res of [
      await service.get({ pk: 'p', sk: 's' }),
      await service.getDetail({ pk: 'p', sk: 's' }),
    ] as any[]) {
      expect(res.systemId).toBe('S1')
      expect(res.attributes).toEqual({ a: 1 })
    }
  })

  it('maps list items', async () => {
    const { service, dataService } = await build()
    dataService.listItemsByPk.mockResolvedValue({ items: [owned()] } as any)
    const res = await service.list({ settingCode: 'X' } as any)
    expect(res.items[0]).toMatchObject({ systemId: 'S1', attributes: { a: 1 } })
  })

  it('maps listByRds items', async () => {
    const { service, prisma } = await build()
    prisma.master.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([owned()])
    prisma.master.count.mockResolvedValue(1)
    mockedUser()
    const res = await service.listByRds({} as any, { invokeContext: invoke })
    expect(res.items[0]).toMatchObject({ systemId: 'S1', attributes: { a: 1 } })
  })

  it('leaves rows with no owner unchanged', async () => {
    const { service, dataService } = await build()
    dataService.getItem.mockResolvedValue({
      id: 'i',
      attributes: { a: 1 },
    } as any)
    const res: any = await service.get({ pk: 'p', sk: 's' })
    expect(res).toEqual({ id: 'i', attributes: { a: 1 } })
    expect(res).not.toHaveProperty('systemId')
  })
})

function mockedUser() {
  ;(getUserContext as jest.Mock).mockReturnValue({ tenantCode: 'T' })
}

describe('MasterDataService ownership and access', () => {
  const invoke = {
    context: { awsRequestId: 'r' },
    event: {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: 'u1',
              'custom:tenant': 'ta',
              'custom:roles': JSON.stringify([{ tenant: 'ta', role: 'user' }]),
            },
          },
        },
      },
    },
  } as any
  const opts = { invokeContext: invoke }
  const all = [{ systemId: '*', settingCode: '*', read: true, write: true }]
  const build = async (grants?: any[]) => {
    ;(getUserContext as jest.Mock).mockReturnValue({
      tenantCode: 'ta',
      userId: 'u1',
      tenantRole: 'user',
      tenantRoles: ['user'],
      tenantGroupIds: [],
    })
    const dataService = createMock<DataService>()
    dataService.getItem.mockResolvedValue(null as any)
    const commandService = createMock<CommandService>()
    commandService.publishAsync.mockImplementation(async (c: any) => c)
    commandService.publishPartialUpdateAsync.mockImplementation(
      async (c: any) => c,
    )
    commandService.getLatestItem.mockResolvedValue({
      attributes: { __systemId: 'A' },
    } as any)
    const registry = new MasterAccessResolverRegistry()
    if (grants) registry.set({ resolveGrants: async () => grants })
    const access = new MasterAccessService(registry, commandService as any)
    const module = await Test.createTestingModule({
      providers: [
        MasterDataService,
        {
          provide: PRISMA_SERVICE,
          useValue: {
            master: { aggregate: jest.fn().mockResolvedValue({ _max: {} }) },
          },
        },
        { provide: CommandService, useValue: commandService },
        { provide: DataService, useValue: dataService },
        { provide: MasterAccessService, useValue: access },
      ],
    }).compile()
    return {
      service: module.get(MasterDataService),
      dataService,
      commandService,
    }
  }
  const dto = (extra: object = {}) => ({
    tenantCode: 'ta',
    settingCode: 'S1',
    code: 'C1',
    name: 'n',
    attributes: { a: 1 },
    ...extra,
  })
  const published = (fn: any) => fn.mock.calls[0][0]

  it('ignores a client systemId and does no lookup without a resolver', async () => {
    const { service, commandService } = await build()
    await service.create(dto({ systemId: 'evil' }) as any, opts)
    const cmd = published(commandService.publishAsync)
    expect(cmd.attributes).toEqual({ a: 1 })
    expect(cmd).not.toHaveProperty('systemId')
    expect(commandService.getLatestItem).not.toHaveBeenCalled()
  })

  it('takes systemId from the setting and hides it in the response', async () => {
    const { service, commandService } = await build(all)
    const res: any = await service.create(dto() as any, opts)
    expect(published(commandService.publishAsync).attributes).toEqual({
      a: 1,
      __systemId: 'A',
    })
    expect(res).toMatchObject({ systemId: 'A', attributes: { a: 1 } })
  })

  it('ignores a client systemId when a resolver is registered', async () => {
    const { service, commandService } = await build(all)
    await service.create(
      dto({ systemId: 'evil', attributes: { __systemId: 'evil' } }) as any,
      opts,
    )
    const cmd = published(commandService.publishAsync)
    expect(cmd.attributes).toEqual({ __systemId: 'A' })
    expect(cmd).not.toHaveProperty('systemId')
  })

  it('rejects a row whose setting does not exist', async () => {
    const { service, commandService } = await build(all)
    commandService.getLatestItem.mockResolvedValue(null)
    await expect(service.create(dto() as any, opts)).rejects.toThrow(
      BadRequestException,
    )
    expect(commandService.publishAsync).not.toHaveBeenCalled()
  })

  it('keeps the stored systemId of an existing row on upsert', async () => {
    const { service, dataService, commandService } = await build(all)
    dataService.getItem.mockResolvedValue({
      isDeleted: true,
      version: 2,
      attributes: { __systemId: 'B' },
    } as any)
    await service.upsert(dto() as any, opts)
    expect(published(commandService.publishAsync).attributes).toEqual({
      a: 1,
      __systemId: 'B',
    })
    expect(commandService.getLatestItem).not.toHaveBeenCalled()
  })

  it('hides systemId in the no-change response', async () => {
    const { service, dataService, commandService } = await build(all)
    commandService.publishAsync.mockResolvedValue(null as any)
    dataService.getItem.mockResolvedValue({
      requestId: 'q',
      attributes: { a: 1, __systemId: 'B' },
    } as any)
    const res: any = await service.upsert(dto() as any, opts)
    expect(res).toMatchObject({ systemId: 'B', attributes: { a: 1 } })
    expect(res).not.toHaveProperty('requestId')
  })

  it('carries systemId through update', async () => {
    const { service, dataService, commandService } = await build(all)
    dataService.getItem.mockResolvedValue({
      sk: 'S1#C1',
      tenantCode: 'ta',
      attributes: { a: 1, __systemId: 'B' },
    } as any)
    const res: any = await service.update(
      { pk: 'p', sk: 'S1#C1' },
      { attributes: { b: 2 } } as any,
      opts,
    )
    expect(
      published(commandService.publishPartialUpdateAsync).attributes,
    ).toEqual({ b: 2, __systemId: 'B' })
    expect(res).toMatchObject({ systemId: 'B', attributes: { b: 2 } })
  })

  it('adopts the setting owner on update of an untagged row', async () => {
    const { service, dataService, commandService } = await build(all)
    dataService.getItem.mockResolvedValue({
      sk: 'S1#C1',
      tenantCode: 'ta',
      attributes: { a: 1 },
    } as any)
    await service.update({ pk: 'p', sk: 'S1#C1' }, { name: 'x' } as any, opts)
    expect(
      published(commandService.publishPartialUpdateAsync).attributes,
    ).toEqual({ a: 1, __systemId: 'A' })
  })

  it('denies update without write on the owner', async () => {
    const { service, dataService, commandService } = await build([
      { systemId: 'A', settingCode: '*', read: true, write: true },
    ])
    dataService.getItem.mockResolvedValue({
      sk: 'S1#C1',
      tenantCode: 'ta',
      attributes: { __systemId: 'B' },
    } as any)
    await expect(
      service.update({ pk: 'p', sk: 'S1#C1' }, { name: 'x' } as any, opts),
    ).rejects.toThrow(ForbiddenException)
    expect(commandService.publishPartialUpdateAsync).not.toHaveBeenCalled()
  })

  it('checks delete against the stored systemId', async () => {
    const { service, dataService, commandService } = await build([
      { systemId: 'A', settingCode: '*', read: true, write: true },
    ])
    dataService.getItem.mockResolvedValue({
      sk: 'S1#C1',
      tenantCode: 'ta',
      isDeleted: false,
      attributes: { __systemId: 'B' },
    } as any)
    await expect(
      service.delete({ pk: 'p', sk: 'S1#C1' }, opts),
    ).rejects.toThrow(ForbiddenException)
    expect(commandService.publishPartialUpdateAsync).not.toHaveBeenCalled()
  })

  it('hides systemId in the delete response', async () => {
    const { service, dataService } = await build(all)
    dataService.getItem.mockResolvedValue({
      sk: 'S1#C1',
      tenantCode: 'ta',
      isDeleted: false,
      attributes: { __systemId: 'B' },
    } as any)
    const res: any = await service.delete({ pk: 'p', sk: 'S1#C1' }, opts)
    expect(res.systemId).toBe('B')
    expect(res.attributes).toEqual({})
  })

  it('uses options.systemId and skips the check for internal callers', async () => {
    const { service, commandService } = await build([])
    await service.create(dto() as any, {
      invokeContext: invoke,
      systemId: 'Z',
      skipAccessCheck: true,
    })
    expect(published(commandService.publishAsync).attributes).toEqual({
      a: 1,
      __systemId: 'Z',
    })
  })

  it('writes nothing when one bulk item is forbidden', async () => {
    const { service, commandService } = await build([
      { systemId: 'A', settingCode: 'S1', read: true, write: true },
    ])
    commandService.getLatestItem.mockImplementation(async (k: any) =>
      k.sk.endsWith('S2')
        ? ({ attributes: { __systemId: 'B' } } as any)
        : ({ attributes: { __systemId: 'A' } } as any),
    )
    await expect(
      service.upsertBulk(
        {
          items: [dto({ code: 'C1' }), dto({ code: 'C2', settingCode: 'S2' })],
        } as any,
        invoke,
      ),
    ).rejects.toThrow(ForbiddenException)
    expect(commandService.publishAsync).not.toHaveBeenCalled()
  })
})

describe('MasterDataService read access', () => {
  const invoke = {
    context: { awsRequestId: 'r' },
    event: {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: 'u1',
              'custom:tenant': 'ta',
              'custom:roles': JSON.stringify([{ tenant: 'ta', role: 'user' }]),
            },
          },
        },
      },
    },
  } as any
  const opts = { invokeContext: invoke }
  const appA = [
    { systemId: 'app-a', settingCode: '*', read: true, write: false },
  ]
  const all = [{ systemId: '*', settingCode: '*', read: true, write: true }]
  const build = async (grants?: any[], user: any = { userId: 'u1' }) => {
    ;(getUserContext as jest.Mock).mockReturnValue({
      tenantCode: 'ta',
      tenantRole: 'user',
      tenantRoles: ['user'],
      tenantGroupIds: [],
      ...user,
    })
    const dataService = createMock<DataService>()
    const commandService = createMock<CommandService>()
    commandService.getLatestItem.mockResolvedValue({
      attributes: { __systemId: 'app-a' },
    } as any)
    const prisma = {
      master: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    }
    const registry = new MasterAccessResolverRegistry()
    if (grants) registry.set({ resolveGrants: async () => grants })
    const access = new MasterAccessService(registry, commandService as any)
    const module = await Test.createTestingModule({
      providers: [
        MasterDataService,
        { provide: PRISMA_SERVICE, useValue: prisma },
        { provide: CommandService, useValue: commandService },
        { provide: DataService, useValue: dataService },
        { provide: MasterAccessService, useValue: access },
      ],
    }).compile()
    return {
      service: module.get(MasterDataService),
      dataService,
      commandService,
      prisma,
    }
  }
  const countWhere = (prisma: any) => prisma.master.count.mock.calls[0][0].where

  it('adds the filter to listByRds so total is filtered', async () => {
    const { service, prisma } = await build(appA)
    await service.listByRds({ pageSize: 10, page: 1 } as any, opts)
    expect(countWhere(prisma).AND).toEqual([{ systemId: 'app-a' }])
    expect(prisma.master.findMany.mock.calls.at(-1)[0].where.AND).toEqual([
      { systemId: 'app-a' },
    ])
  })

  it('narrows listByRds to the search systemId', async () => {
    const { service, prisma } = await build(all)
    await service.listByRds(
      { pageSize: 10, page: 1, systemId: 'app-a' } as any,
      opts,
    )
    expect(countWhere(prisma).AND).toEqual([{ systemId: 'app-a' }])
  })

  it('does not reference systemId in where without a resolver', async () => {
    const { service, prisma } = await build()
    await service.listByRds(
      { pageSize: 10, page: 1, systemId: 'app-a' } as any,
      opts,
    )
    expect(JSON.stringify(countWhere(prisma))).not.toContain('systemId')
  })

  it('still applies grants with includeCommon', async () => {
    const { service, prisma } = await build(appA)
    await service.listByRds(
      { pageSize: 10, page: 1, includeCommon: true } as any,
      opts,
    )
    const where = countWhere(prisma)
    expect(where.OR).toBeDefined()
    expect(where.AND).toEqual([{ systemId: 'app-a' }])
  })

  it('rejects listByRds for another tenant header', async () => {
    const { service } = await build(all, { userId: undefined })
    await expect(
      service.listByRds({ pageSize: 10, page: 1 } as any, opts),
    ).rejects.toThrow(ForbiddenException)
  })

  it('uses scope.tenantCode for an anonymous list', async () => {
    const { service, prisma } = await build(appA, { userId: undefined })
    await service.listByRds({ pageSize: 10, page: 1 } as any, {
      invokeContext: invoke,
      scope: { tenantCode: 'tz' },
    })
    expect(countWhere(prisma).tenantCode).toBe('tz')
  })

  it('checks list against the setting owner', async () => {
    const { service, dataService, commandService } = await build(appA)
    dataService.listItemsByPk.mockResolvedValue({ items: [] } as any)
    const search = { tenantCode: 'ta', settingCode: 'S1' } as any
    await expect(service.list(search, opts)).resolves.toBeDefined()
    commandService.getLatestItem.mockResolvedValue({
      attributes: { __systemId: 'other' },
    } as any)
    await expect(service.list(search, opts)).rejects.toThrow(ForbiddenException)
  })

  it('denies get for a system with no grant', async () => {
    const { service, dataService } = await build(appA)
    dataService.getItem.mockResolvedValue({
      tenantCode: 'ta',
      sk: 'S1#C1',
      attributes: { __systemId: 'other' },
    } as any)
    await expect(
      service.get({ pk: 'MASTER#ta', sk: 'S1#C1' }, opts),
    ).rejects.toThrow(ForbiddenException)
  })

  it('returns a granted row from get', async () => {
    const { service, dataService } = await build(appA)
    dataService.getItem.mockResolvedValue({
      tenantCode: 'ta',
      sk: 'S1#C1',
      attributes: { __systemId: 'app-a' },
    } as any)
    expect(
      await service.get({ pk: 'MASTER#ta', sk: 'S1#C1' }, opts),
    ).toMatchObject({ systemId: 'app-a' })
  })

  it('does not check get when the row is missing', async () => {
    const { service, dataService } = await build(appA)
    dataService.getItem.mockResolvedValue(null as any)
    await expect(
      service.get({ pk: 'MASTER#ta', sk: 'S1#C1' }, opts),
    ).resolves.toBeDefined()
  })

  it('handles a setting key on getDetail', async () => {
    const { service, dataService } = await build([
      { systemId: 'app-a', settingCode: 'S1', read: true, write: false },
    ])
    dataService.getItem.mockResolvedValue({
      tenantCode: 'ta',
      sk: 'MASTER_SETTING#S1',
      attributes: { __systemId: 'app-a' },
    } as any)
    await expect(
      service.getDetail({ pk: 'MASTER#ta', sk: 'MASTER_SETTING#S1' }, opts),
    ).resolves.toBeDefined()
    dataService.getItem.mockResolvedValue({
      tenantCode: 'ta',
      sk: 'MASTER_SETTING#S2',
      attributes: { __systemId: 'app-a' },
    } as any)
    await expect(
      service.getDetail({ pk: 'MASTER#ta', sk: 'MASTER_SETTING#S2' }, opts),
    ).rejects.toThrow(ForbiddenException)
  })

  it('checks a personal setting key against the base setting owner', async () => {
    const key = { pk: 'MASTER#ta', sk: 'MASTER_SETTING#USER#u1#S1' }
    const row = { tenantCode: 'ta', sk: key.sk, attributes: { v: 1 } }
    // the base setting S1 is owned by app-a (getLatestItem in build)
    const shared = await build([
      { systemId: 'shared', settingCode: '*', read: true, write: false },
    ])
    shared.dataService.getItem.mockResolvedValue(row as any)
    await expect(shared.service.getDetail(key, opts)).rejects.toThrow(
      ForbiddenException,
    )
    const owner = await build(appA)
    owner.dataService.getItem.mockResolvedValue(row as any)
    await expect(owner.service.getDetail(key, opts)).resolves.toBeDefined()
  })

  it('reports an existing code owned by another system', async () => {
    const { service, dataService } = await build(appA)
    dataService.getItem.mockResolvedValue({
      isDeleted: false,
      attributes: { __systemId: 'other' },
    } as any)
    expect(await service.checkExistCode('ta', 'S1', 'C1', opts)).toBe(true)
  })

  it('rejects checkExistCode for another tenant', async () => {
    const { service } = await build(appA)
    await expect(
      service.checkExistCode('tb', 'S1', 'C1', opts),
    ).rejects.toThrow(ForbiddenException)
  })
})
