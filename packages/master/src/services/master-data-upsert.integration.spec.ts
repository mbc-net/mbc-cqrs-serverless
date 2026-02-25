import { Test, TestingModule } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'
import {
  CommandService,
  DataService,
  getUserContext,
  UserContext,
  DataModel,
  CommandModel,
} from '@mbc-cqrs-serverless/core'
import { MasterDataService } from './master-data.service'
import { PRISMA_SERVICE } from '../master.module-definition'
import { MasterDataEntity } from '../entities'
import { MasterDataCreateDto } from '../dto'

jest.mock('@mbc-cqrs-serverless/core', () => ({
  ...jest.requireActual('@mbc-cqrs-serverless/core'),
  getUserContext: jest.fn(),
}))

describe('Master Data Upsert Integration', () => {
  let service: MasterDataService
  let prismaService: any
  let commandService: jest.Mocked<CommandService>
  let dataService: jest.Mocked<DataService>

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
        aggregate: jest.fn().mockResolvedValue({ _max: { seq: null } }),
      },
    }

    const mockGetUserContext = getUserContext as jest.MockedFunction<
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

  it('should create data via bulk endpoint when not exists', async () => {
    const items: MasterDataCreateDto[] = [
      {
        settingCode: 'SETTING_A',
        name: 'Item A',
        code: 'CODE_A',
        seq: 1,
        attributes: { field1: 'value1' },
      },
      {
        settingCode: 'SETTING_A',
        name: 'Item B',
        code: 'CODE_B',
        seq: 2,
        attributes: { field1: 'value2' },
      },
    ]

    dataService.getItem.mockResolvedValue(null)

    commandService.publishAsync
      .mockResolvedValueOnce({
        id: 'MASTER#TEST_TENANT#SETTING_A#CODE_A',
        pk: 'MASTER#TEST_TENANT',
        sk: 'SETTING_A#CODE_A',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        name: 'Item A',
        code: 'CODE_A',
        seq: 1,
        attributes: { field1: 'value1' },
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: 'MASTER#TEST_TENANT#SETTING_A#CODE_B',
        pk: 'MASTER#TEST_TENANT',
        sk: 'SETTING_A#CODE_B',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        name: 'Item B',
        code: 'CODE_B',
        seq: 2,
        attributes: { field1: 'value2' },
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

    const result = await service.upsertBulk({ items }, mockInvokeContext)

    expect(result).toHaveLength(2)
    expect(result[0]).toBeInstanceOf(MasterDataEntity)
    expect(result[1]).toBeInstanceOf(MasterDataEntity)
    expect(result[0].name).toBe('Item A')
    expect(result[1].name).toBe('Item B')
    expect(commandService.publishAsync).toHaveBeenCalledTimes(2)
  })

  it('should update data via bulk endpoint when exists with changes', async () => {
    const items: MasterDataCreateDto[] = [
      {
        settingCode: 'SETTING_A',
        name: 'Updated Item',
        code: 'CODE_A',
        seq: 1,
        attributes: { field1: 'new-value' },
      },
    ]

    const existingData: DataModel = {
      id: 'existing-id',
      pk: 'MASTER#TEST_TENANT',
      sk: 'SETTING_A#CODE_A',
      code: 'CODE_A',
      name: 'Original Item',
      version: 3,
      type: 'MASTER',
      tenantCode: 'TEST_TENANT',
      isDeleted: false,
      attributes: { field1: 'old-value' },
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    dataService.getItem.mockResolvedValue(existingData)
    commandService.publishAsync.mockResolvedValue({
      id: 'MASTER#TEST_TENANT#SETTING_A#CODE_A',
      pk: 'MASTER#TEST_TENANT',
      sk: 'SETTING_A#CODE_A',
      version: 4,
      type: 'MASTER',
      tenantCode: 'TEST_TENANT',
      name: 'Updated Item',
      code: 'CODE_A',
      seq: 1,
      attributes: { field1: 'new-value' },
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const result = await service.upsertBulk({ items }, mockInvokeContext)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Updated Item')
    expect(commandService.publishAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 3,
      }),
      expect.any(Object),
    )
  })

  it('should skip unchanged data via bulk endpoint', async () => {
    const items: MasterDataCreateDto[] = [
      {
        settingCode: 'SETTING_A',
        name: 'Same Data',
        code: 'CODE_A',
        seq: 1,
        attributes: { field1: 'same-value' },
      },
    ]

    const existingData: DataModel = {
      id: 'existing-id',
      pk: 'MASTER#TEST_TENANT',
      sk: 'SETTING_A#CODE_A',
      code: 'CODE_A',
      name: 'Same Data',
      version: 2,
      type: 'MASTER',
      tenantCode: 'TEST_TENANT',
      isDeleted: false,
      attributes: { field1: 'same-value' },
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    dataService.getItem.mockResolvedValue(existingData)
    commandService.publishAsync.mockResolvedValue(null) // not dirty

    const result = await service.upsertBulk({ items }, mockInvokeContext)

    expect(result).toHaveLength(1)
    expect(result[0]).toBeInstanceOf(MasterDataEntity)
    expect(result[0].name).toBe('Same Data')
  })

  it('should handle mixed new/existing/unchanged items', async () => {
    const items: MasterDataCreateDto[] = [
      {
        settingCode: 'SETTING_A',
        name: 'New Item',
        code: 'NEW_CODE',
        seq: 1,
        attributes: { type: 'new' },
      },
      {
        settingCode: 'SETTING_A',
        name: 'Updated Item',
        code: 'EXIST_CODE',
        seq: 2,
        attributes: { type: 'updated' },
      },
      {
        settingCode: 'SETTING_A',
        name: 'Same Item',
        code: 'SAME_CODE',
        seq: 3,
        attributes: { type: 'same' },
      },
    ]

    const existingItem: DataModel = {
      id: 'existing-id',
      pk: 'MASTER#TEST_TENANT',
      sk: 'SETTING_A#EXIST_CODE',
      code: 'EXIST_CODE',
      name: 'Original Item',
      version: 2,
      type: 'MASTER',
      tenantCode: 'TEST_TENANT',
      isDeleted: false,
      attributes: { type: 'original' },
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const unchangedItem: DataModel = {
      id: 'unchanged-id',
      pk: 'MASTER#TEST_TENANT',
      sk: 'SETTING_A#SAME_CODE',
      code: 'SAME_CODE',
      name: 'Same Item',
      version: 1,
      type: 'MASTER',
      tenantCode: 'TEST_TENANT',
      isDeleted: false,
      attributes: { type: 'same' },
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // First call: new item (null), second: existing, third: unchanged
    dataService.getItem
      .mockResolvedValueOnce(null) // new
      .mockResolvedValueOnce(existingItem) // existing with changes
      .mockResolvedValueOnce(unchangedItem) // unchanged

    commandService.publishAsync
      .mockResolvedValueOnce({
        id: 'new-id',
        pk: 'MASTER#TEST_TENANT',
        sk: 'SETTING_A#NEW_CODE',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        name: 'New Item',
        code: 'NEW_CODE',
        seq: 1,
        attributes: { type: 'new' },
        isDeleted: false,
        requestId: 'req-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: 'existing-id',
        pk: 'MASTER#TEST_TENANT',
        sk: 'SETTING_A#EXIST_CODE',
        version: 3,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        name: 'Updated Item',
        code: 'EXIST_CODE',
        seq: 2,
        attributes: { type: 'updated' },
        isDeleted: false,
        requestId: 'req-2',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce(null) // unchanged, not dirty

    const result = await service.upsertBulk({ items }, mockInvokeContext)

    expect(result).toHaveLength(3)

    // New item
    expect(result[0].name).toBe('New Item')
    expect(result[0].requestId).toBe('req-1')

    // Updated item
    expect(result[1].name).toBe('Updated Item')
    expect(result[1].requestId).toBe('req-2')

    // Unchanged item (returned existing data)
    expect(result[2].name).toBe('Same Item')
    expect(result[2].requestId).toBeUndefined()
  })
})
