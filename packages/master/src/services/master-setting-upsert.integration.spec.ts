import { Test, TestingModule } from '@nestjs/testing'
import {
  CommandService,
  DataService,
  DynamoDbService,
  getUserContext,
  JwtClaims,
  KEY_SEPARATOR,
  DataModel,
  CommandModel,
} from '@mbc-cqrs-serverless/core'
import { TaskService } from '@mbc-cqrs-serverless/task'
import { MasterSettingService } from './master-setting.service'
import { PRISMA_SERVICE } from '../master.module-definition'
import { CommonSettingDto } from '../dto'

const mockInvokeContext = {
  event: {
    requestContext: {
      accountId: '1',
      http: {
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'PostmanRuntime/7.28.4',
      },
      requestId: '81bf1821-34b0-4dc5-a2ce-685d37d22f8c',
      authorizer: {
        jwt: {
          claims: {
            sub: 'abc',
            'custom:roles': '[{"tenant":"MBC","role":"admin"}]',
          } as JwtClaims,
        },
      },
    },
  },
  context: {
    awsRequestId: '81bf1821-34b0-4dc5-a2ce-685d37d22f8c',
  },
}

describe('Master Setting Upsert Integration', () => {
  let service: MasterSettingService
  let dataService: jest.Mocked<DataService>
  let commandService: jest.Mocked<CommandService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MasterSettingService,
        {
          provide: TaskService,
          useValue: { createStepFunctionTask: jest.fn() },
        },
        {
          provide: PRISMA_SERVICE,
          useValue: {},
        },
        {
          provide: CommandService,
          useValue: {
            publishAsync: jest.fn(),
            publishPartialUpdateAsync: jest.fn(),
          },
        },
        {
          provide: DataService,
          useValue: {
            getItem: jest.fn(),
            listItemsByPk: jest.fn(),
          },
        },
        {
          provide: DynamoDbService,
          useValue: {
            getItem: jest.fn(),
            getTableName: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<MasterSettingService>(MasterSettingService)
    dataService = module.get<DataService>(
      DataService,
    ) as jest.Mocked<DataService>
    commandService = module.get<CommandService>(
      CommandService,
    ) as jest.Mocked<CommandService>
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should create settings via bulk endpoint when not exists', async () => {
    const items: CommonSettingDto[] = [
      {
        code: 'Setting1',
        name: 'Setting 1',
        settingValue: { description: 'First setting', fields: [] },
      },
      {
        code: 'Setting2',
        name: 'Setting 2',
        settingValue: { description: 'Second setting', fields: [] },
      },
    ]

    dataService.getItem.mockResolvedValue(null)
    commandService.publishAsync
      .mockResolvedValueOnce({
        pk: 'SETTING#MBC',
        sk: 'SETTING#Setting1',
        id: 'SETTING#MBC#SETTING#Setting1',
        attributes: items[0].settingValue,
        code: 'Setting1',
        version: 1,
        tenantCode: 'MBC',
        name: 'Setting 1',
        type: 'MASTER',
        isDeleted: false,
        requestId: 'req-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce({
        pk: 'SETTING#MBC',
        sk: 'SETTING#Setting2',
        id: 'SETTING#MBC#SETTING#Setting2',
        attributes: items[1].settingValue,
        code: 'Setting2',
        version: 1,
        tenantCode: 'MBC',
        name: 'Setting 2',
        type: 'MASTER',
        isDeleted: false,
        requestId: 'req-2',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

    const result = await service.upsertBulk({ items }, mockInvokeContext)

    expect(result).toHaveLength(2)
    expect(result[0].code).toBe('Setting1')
    expect(result[1].code).toBe('Setting2')
    expect(commandService.publishAsync).toHaveBeenCalledTimes(2)
  })

  it('should update settings via bulk endpoint when exists with changes', async () => {
    const items: CommonSettingDto[] = [
      {
        code: 'ExistingSetting',
        name: 'Updated Setting',
        settingValue: { description: 'Updated', fields: [{ name: 'new' }] },
      },
    ]

    const existingData: DataModel = {
      id: 'existing-id',
      pk: 'SETTING#MBC',
      sk: 'SETTING#ExistingSetting',
      code: 'ExistingSetting',
      name: 'Old Setting',
      version: 2,
      type: 'MASTER',
      tenantCode: 'MBC',
      isDeleted: false,
      attributes: { description: 'Old', fields: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    dataService.getItem.mockResolvedValue(existingData)
    commandService.publishAsync.mockResolvedValue({
      ...existingData,
      name: 'Updated Setting',
      attributes: items[0].settingValue,
      version: 3,
    })

    const result = await service.upsertBulk({ items }, mockInvokeContext)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Updated Setting')
    expect(commandService.publishAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 2,
        isDeleted: false,
      }),
      expect.any(Object),
    )
  })

  it('should skip unchanged settings via bulk endpoint', async () => {
    const items: CommonSettingDto[] = [
      {
        code: 'SameSetting',
        name: 'Same Setting',
        settingValue: { description: 'Same', fields: [] },
      },
    ]

    const existingData: DataModel = {
      id: 'existing-id',
      pk: 'SETTING#MBC',
      sk: 'SETTING#SameSetting',
      code: 'SameSetting',
      name: 'Same Setting',
      version: 1,
      type: 'MASTER',
      tenantCode: 'MBC',
      isDeleted: false,
      attributes: { description: 'Same', fields: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    dataService.getItem.mockResolvedValue(existingData)
    commandService.publishAsync.mockResolvedValue(null) // not dirty

    const result = await service.upsertBulk({ items }, mockInvokeContext)

    expect(result).toHaveLength(1)
    expect(result[0].code).toBe('SameSetting')
  })

  it('should handle mixed new/existing/unchanged settings', async () => {
    const items: CommonSettingDto[] = [
      {
        code: 'NewSetting',
        name: 'New Setting',
        settingValue: { type: 'new' },
      },
      {
        code: 'UpdatedSetting',
        name: 'Updated Setting',
        settingValue: { type: 'updated' },
      },
      {
        code: 'SameSetting',
        name: 'Same Setting',
        settingValue: { type: 'same' },
      },
    ]

    const existingUpdated: DataModel = {
      id: 'existing-updated',
      pk: 'SETTING#MBC',
      sk: 'SETTING#UpdatedSetting',
      code: 'UpdatedSetting',
      name: 'Old Setting',
      version: 2,
      type: 'MASTER',
      tenantCode: 'MBC',
      isDeleted: false,
      attributes: { type: 'original' },
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const existingSame: DataModel = {
      id: 'existing-same',
      pk: 'SETTING#MBC',
      sk: 'SETTING#SameSetting',
      code: 'SameSetting',
      name: 'Same Setting',
      version: 1,
      type: 'MASTER',
      tenantCode: 'MBC',
      isDeleted: false,
      attributes: { type: 'same' },
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    dataService.getItem
      .mockResolvedValueOnce(null) // new
      .mockResolvedValueOnce(existingUpdated) // existing with changes
      .mockResolvedValueOnce(existingSame) // unchanged

    commandService.publishAsync
      .mockResolvedValueOnce({
        pk: 'SETTING#MBC',
        sk: 'SETTING#NewSetting',
        id: 'SETTING#MBC#SETTING#NewSetting',
        code: 'NewSetting',
        version: 1,
        tenantCode: 'MBC',
        name: 'New Setting',
        type: 'MASTER',
        isDeleted: false,
        attributes: { type: 'new' },
        requestId: 'req-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce({
        ...existingUpdated,
        name: 'Updated Setting',
        attributes: { type: 'updated' },
        version: 3,
        requestId: 'req-2',
      })
      .mockResolvedValueOnce(null) // not dirty

    const result = await service.upsertBulk({ items }, mockInvokeContext)

    expect(result).toHaveLength(3)

    // New setting
    expect(result[0].code).toBe('NewSetting')
    expect(result[0].requestId).toBe('req-1')

    // Updated setting
    expect(result[1].code).toBe('UpdatedSetting')
    expect(result[1].name).toBe('Updated Setting')
    expect(result[1].requestId).toBe('req-2')

    // Unchanged setting (returned existing data)
    expect(result[2].code).toBe('SameSetting')
    expect(result[2].requestId).toBeUndefined()
  })
})
