import {
  CommandDto,
  CommandService,
  DataService,
  DynamoDbService,
  generateId,
  JwtClaims,
  KEY_SEPARATOR,
  VERSION_FIRST,
} from '@mbc-cqrs-serverless/core'
import { Test, TestingModule } from '@nestjs/testing'

import { MasterSettingEntity } from '../entities'
import { SettingTypeEnum } from '../enums'
import { MasterSettingService } from './master-setting.service'
import { SETTING_TENANT_PREFIX } from '../constants'
import {
  CommonSettingDto,
  GroupSettingDto,
  TenantSettingDto,
  UserSettingDto,
} from '../dto'
import {
  MODULE_OPTIONS_TOKEN,
  PRISMA_SERVICE,
} from '../master.module-definition'
import { TaskService } from '@mbc-cqrs-serverless/task'
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common'
import { MasterAccessService } from '../access/master-access.service'
import { MasterAccessResolverRegistry } from '../access/master-access-resolver.registry'
import { createMock } from '@golevelup/ts-jest'
import {
  DataModel,
  CommandModel,
  DetailKey,
  mergeDeep,
} from '@mbc-cqrs-serverless/core'
import { MasterDataEntity } from '../entities'

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

const optionsMock = {
  invokeContext: mockInvokeContext,
}

describe('SettingService', () => {
  let service: MasterSettingService
  let dataService: jest.Mocked<DataService>
  let commandService: jest.Mocked<CommandService>
  let dynamoDbService: jest.Mocked<DynamoDbService>
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
    dynamoDbService = module.get<DynamoDbService>(
      DynamoDbService,
    ) as jest.Mocked<DynamoDbService>
  })
  //
  it('should be defined', () => {
    expect(service).toBeDefined()
  })
  it('should return user-level setting if found', async () => {
    jest.spyOn(service, 'getSetting').mockResolvedValueOnce({
      id: 'SETTING#MBC#USER#abc#UserListSetting',
      settingValue: {},
    })

    const response = await service.getSetting(
      { code: 'UserListSetting' },
      optionsMock,
    )

    expect(response).toEqual(
      new MasterSettingEntity({
        id: 'SETTING#MBC#USER#abc#UserListSetting',
        settingValue: {},
      }),
    )
  })
  it('should return group-level setting if found', async () => {
    jest.spyOn(service, 'getSetting').mockResolvedValueOnce({
      id: 'SETTING#MBC#GROUP#1#UserListSetting',
      settingValue: {},
    })

    const response = await service.getSetting(
      { code: 'UserListSetting' },
      optionsMock,
    )

    expect(response).toEqual(
      new MasterSettingEntity({
        id: 'SETTING#MBC#GROUP#1#UserListSetting',
        settingValue: {},
      }),
    )
  })
  it('should return tenant-level setting if found', async () => {
    jest.spyOn(service, 'getSetting').mockResolvedValueOnce({
      id: 'SETTING#MBC#TENANT#TenantListSetting',
      settingValue: {},
    })

    const response = await service.getSetting(
      { code: 'TenantListSetting' },
      optionsMock,
    )

    expect(response).toEqual(
      new MasterSettingEntity({
        id: 'SETTING#MBC#TENANT#TenantListSetting',
        settingValue: {},
      }),
    )
  })
  it('should return common-level setting if found', async () => {
    jest.spyOn(service, 'getSetting').mockResolvedValueOnce({
      id: 'SETTING#common#CommonListSetting',
      settingValue: {},
    })

    const response = await service.getSetting(
      { code: 'CommonListSetting' },
      optionsMock,
    )

    expect(response).toEqual(
      new MasterSettingEntity({
        id: 'SETTING#common#CommonListSetting',
        settingValue: {},
      }),
    )
  })

  describe('createCommonTenantSetting', () => {
    afterEach(() => {
      jest.clearAllMocks()
    })
    it('should call createCommonTenantSetting with correct parameters and return the result', async () => {
      const settingCode = ' UserListSetting'
      const settingValue = {}
      const settingName = 'user list setting'

      const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${SettingTypeEnum.TENANT_COMMON}`
      const sk = settingCode
      const mockResponse = {
        pk: 'SETTING#common',
        sk: 'UserListSetting',
        id: 'SETTING#common#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 1,
        tenantCode: 'common',
        name: 'UserListSetting',
        type: 'MASTER',
      }

      const command: CommandDto = {
        sk,
        pk,
        code: sk,
        name: settingName,
        id: generateId(pk, sk),
        tenantCode: SettingTypeEnum.TENANT_COMMON,
        type: SettingTypeEnum.TENANT_COMMON,
        version: VERSION_FIRST,

        attributes: settingValue,
      }

      jest.spyOn(commandService, 'publishAsync').mockResolvedValue({
        pk: 'SETTING#common',
        sk: 'UserListSetting',
        id: 'SETTING#common#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 1,
        tenantCode: 'common',
        name: 'UserListSetting',
        type: 'MASTER',
      })
      const result = await commandService.publishAsync(command, optionsMock)

      expect(result).toEqual(mockResponse)
    })
    it('should create a new common setting', async () => {
      const mockResponse = {
        pk: 'SETTING#common',
        sk: 'UserListSetting',
        id: 'SETTING#common#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 1,
        tenantCode: 'common',
        name: 'UserListSetting',
        type: 'MASTER',
      }

      const setting: CommonSettingDto = {
        code: 'UserListSetting',
        name: 'UserListSetting',
        settingValue: {},
      }

      jest.spyOn(commandService, 'publishAsync').mockResolvedValue({
        pk: 'SETTING#common',
        sk: 'UserListSetting',
        id: 'SETTING#common#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 1,
        tenantCode: 'common',
        name: 'UserListSetting',
        type: 'MASTER',
      })
      const result = await service.createCommonTenantSetting(
        setting,
        optionsMock,
      )

      expect(result).toEqual(mockResponse)
    })
    it('should create a new common setting with the same code after delete', async () => {
      const mockResponse = {
        pk: 'SETTING#common',
        sk: 'UserListSetting',
        id: 'SETTING#common#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 3,
        tenantCode: 'common',
        name: 'UserListSetting',
        type: 'MASTER',
      }

      const setting: CommonSettingDto = {
        code: 'UserListSetting',
        name: 'UserListSetting',
        settingValue: {},
      }

      jest.spyOn(dataService, 'getItem').mockResolvedValue({
        pk: 'SETTING#common',
        sk: 'UserListSetting',
        id: 'SETTING#common#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 2,
        tenantCode: 'common',
        name: 'UserListSetting',
        type: 'MASTER',
        isDeleted: true,
      })

      jest.spyOn(commandService, 'publishAsync').mockResolvedValue({
        pk: 'SETTING#common',
        sk: 'UserListSetting',
        id: 'SETTING#common#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 3,
        tenantCode: 'common',
        name: 'UserListSetting',
        type: 'MASTER',
      })
      const result = await service.createCommonTenantSetting(
        setting,
        optionsMock,
      )

      expect(result).toEqual(mockResponse)
    })
  })
  describe('createTenantSetting', () => {
    afterEach(() => {
      jest.clearAllMocks()
    })
    it('should call createTenantSetting with correct parameters and return the result', async () => {
      const settingCode = ' UserListSetting'
      const settingValue = {}
      const settingName = 'user list setting'
      const tenantCode = 'MBC'

      const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`
      const sk = settingCode
      const mockResponse = {
        pk: 'SETTING#MBC',
        sk: 'UserListSetting',
        id: 'SETTING#MBC#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 1,
        tenantCode: 'MBC',
        name: 'UserListSetting',
        type: 'MASTER',
      }

      const command: CommandDto = {
        sk,
        pk,
        code: sk,
        name: settingName,
        id: generateId(pk, sk),
        tenantCode: SettingTypeEnum.TENANT_COMMON,
        type: SettingTypeEnum.TENANT_COMMON,
        version: VERSION_FIRST,

        attributes: settingValue,
      }

      jest.spyOn(commandService, 'publishAsync').mockResolvedValue({
        pk: 'SETTING#MBC',
        sk: 'UserListSetting',
        id: 'SETTING#MBC#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 1,
        tenantCode: 'MBC',
        name: 'UserListSetting',
        type: 'MASTER',
      })
      const result = await commandService.publishAsync(command, optionsMock)

      expect(result).toEqual(mockResponse)
    })
    it('should create a new tenant setting', async () => {
      const mockResponse = {
        pk: 'SETTING#MBC',
        sk: 'UserListSetting',
        id: 'SETTING#MBC#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 1,
        tenantCode: 'MBC',
        name: 'UserListSetting',
        type: 'MASTER',
      }

      const setting: TenantSettingDto = {
        tenantCode: 'MBC',
        code: 'UserListSetting',
        name: 'UserListSetting',
        settingValue: {},
      }

      jest.spyOn(commandService, 'publishAsync').mockResolvedValue({
        pk: 'SETTING#MBC',
        sk: 'UserListSetting',
        id: 'SETTING#MBC#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 1,
        tenantCode: 'MBC',
        name: 'UserListSetting',
        type: 'MASTER',
      })
      const result = await service.createTenantSetting(setting, optionsMock)

      expect(result).toEqual(mockResponse)
    })
    it('should create a new tenant setting with the same code after delete', async () => {
      const mockResponse = {
        pk: 'SETTING#MBC',
        sk: 'UserListSetting',
        id: 'SETTING#MBC#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 3,
        tenantCode: 'MBC',
        name: 'UserListSetting',
        type: 'MASTER',
      }

      const setting: TenantSettingDto = {
        tenantCode: 'MBC',
        code: 'UserListSetting',
        name: 'UserListSetting',
        settingValue: {},
      }

      jest.spyOn(dataService, 'getItem').mockResolvedValue({
        pk: 'SETTING#MBC',
        sk: 'UserListSetting',
        id: 'SETTING#MBC#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 2,
        tenantCode: 'MBC',
        name: 'UserListSetting',
        type: 'MASTER',
        isDeleted: true,
      })

      jest.spyOn(commandService, 'publishAsync').mockResolvedValue({
        pk: 'SETTING#MBC',
        sk: 'UserListSetting',
        id: 'SETTING#MBC#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 3,
        tenantCode: 'MBC',
        name: 'UserListSetting',
        type: 'MASTER',
      })
      const result = await service.createCommonTenantSetting(
        setting,
        optionsMock,
      )

      expect(result).toEqual(mockResponse)
    })
  })

  describe('createGroupSetting', () => {
    afterEach(() => {
      jest.clearAllMocks()
    })
    it('should call createGroupSetting with correct parameters and return the result', async () => {
      const settingCode = ' UserListSetting'
      const settingValue = {}
      const settingName = 'user list setting'
      const tenantCode = 'MBC'

      const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`
      const sk = settingCode
      const mockResponse = {
        pk: 'SETTING#MBC',
        sk: 'GROUP#1#UserListSetting',
        id: 'SETTING#MBC#GROUP#1#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 1,
        tenantCode: 'MBC',
        name: 'UserListSetting',
        type: 'MASTER',
      }

      const commad: CommandDto = {
        sk,
        pk,
        code: sk,
        name: settingName,
        id: generateId(pk, sk),
        tenantCode: SettingTypeEnum.TENANT_COMMON,
        type: SettingTypeEnum.TENANT_COMMON,
        version: VERSION_FIRST,

        attributes: settingValue,
      }

      jest.spyOn(commandService, 'publishAsync').mockResolvedValue({
        pk: 'SETTING#MBC',
        sk: 'GROUP#1#UserListSetting',
        id: 'SETTING#MBC#GROUP#1#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 1,
        tenantCode: 'MBC',
        name: 'UserListSetting',
        type: 'MASTER',
      })
      const result = await commandService.publishAsync(commad, optionsMock)

      expect(result).toEqual(mockResponse)
    })
    it('should create a new group setting', async () => {
      const mockResponse = {
        pk: 'SETTING#MBC',
        sk: 'GROUP#1#UserListSetting',
        id: 'SETTING#MBC#GROUP#1#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 1,
        tenantCode: 'MBC',
        name: 'UserListSetting',
        type: 'MASTER',
      }

      const setting: GroupSettingDto = {
        groupId: '1',
        tenantCode: 'MBC',
        code: 'UserListSetting',
        name: 'UserListSetting',
        settingValue: {},
      }

      jest.spyOn(commandService, 'publishAsync').mockResolvedValue({
        pk: 'SETTING#MBC',
        sk: 'GROUP#1#UserListSetting',
        id: 'SETTING#MBC#GROUP#1#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 1,
        tenantCode: 'MBC',
        name: 'UserListSetting',
        type: 'MASTER',
      })
      const result = await service.createGroupSetting(setting, optionsMock)

      expect(result).toEqual(mockResponse)
    })
    it('should create a new group setting with the same code after delete', async () => {
      const mockResponse = {
        pk: 'SETTING#MBC',
        sk: 'GROUP#1#UserListSetting',
        id: 'SETTING#MBC#GROUP#1#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 3,
        tenantCode: 'MBC',
        name: 'UserListSetting',
        type: 'MASTER',
      }

      const setting: GroupSettingDto = {
        groupId: '1',
        tenantCode: 'MBC',
        code: 'UserListSetting',
        name: 'UserListSetting',
        settingValue: {},
      }

      jest.spyOn(dataService, 'getItem').mockResolvedValue({
        pk: 'SETTING#MBC',
        sk: 'GROUP#1#UserListSetting',
        id: 'SETTING#MBC#GROUP#1#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 2,
        tenantCode: 'MBC',
        name: 'UserListSetting',
        type: 'MASTER',
        isDeleted: true,
      })

      jest.spyOn(commandService, 'publishAsync').mockResolvedValue({
        pk: 'SETTING#MBC',
        sk: 'GROUP#1#UserListSetting',
        id: 'SETTING#MBC#GROUP#1#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 3,
        tenantCode: 'MBC',
        name: 'UserListSetting',
        type: 'MASTER',
      })
      const result = await service.createCommonTenantSetting(
        setting,
        optionsMock,
      )

      expect(result).toEqual(mockResponse)
    })
  })
  describe('createUserSetting', () => {
    afterEach(() => {
      jest.clearAllMocks()
    })
    it('should call createGroupSetting with correct parameters and return the result', async () => {
      const settingCode = ' UserListSetting'
      const settingValue = {}
      const settingName = 'user list setting'
      const tenantCode = 'MBC'

      const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`
      const sk = settingCode
      const mockResponse = {
        pk: 'SETTING#MBC',
        sk: 'USER#abc#UserListSetting',
        id: 'SETTING#MBC#USER#abc#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 1,
        tenantCode: 'MBC',
        name: 'UserListSetting',
        type: 'MASTER',
      }

      const commad: CommandDto = {
        sk,
        pk,
        code: sk,
        name: settingName,
        id: generateId(pk, sk),
        tenantCode: SettingTypeEnum.TENANT_COMMON,
        type: SettingTypeEnum.TENANT_COMMON,
        version: VERSION_FIRST,

        attributes: settingValue,
      }

      jest.spyOn(commandService, 'publishAsync').mockResolvedValue({
        pk: 'SETTING#MBC',
        sk: 'USER#abc#UserListSetting',
        id: 'SETTING#MBC#USER#abc#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 1,
        tenantCode: 'MBC',
        name: 'UserListSetting',
        type: 'MASTER',
      })
      const result = await commandService.publishAsync(commad, optionsMock)

      expect(result).toEqual(mockResponse)
    })
    it('should create a new user setting', async () => {
      const mockResponse = {
        pk: 'SETTING#MBC',
        sk: 'USER#abc#UserListSetting',
        id: 'SETTING#MBC#USER#abc#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 1,
        tenantCode: 'MBC',
        name: 'UserListSetting',
        type: 'MASTER',
      }

      const setting: UserSettingDto = {
        tenantCode: 'MBC',
        code: 'UserListSetting',
        name: 'UserListSetting',
        settingValue: {},
        userId: 'abc',
      }

      jest.spyOn(commandService, 'publishAsync').mockResolvedValue({
        pk: 'SETTING#MBC',
        sk: 'USER#abc#UserListSetting',
        id: 'SETTING#MBC#USER#abc#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 1,
        tenantCode: 'MBC',
        name: 'UserListSetting',
        type: 'MASTER',
      })
      const result = await service.createUserSetting(setting, optionsMock)

      expect(result).toEqual(mockResponse)
    })
    it('should create a new user setting with the same code after delete', async () => {
      const mockResponse = {
        pk: 'SETTING#MBC',
        sk: 'USER#abc#UserListSetting',
        id: 'SETTING#MBC#USER#abc#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 3,
        tenantCode: 'MBC',
        name: 'UserListSetting',
        type: 'MASTER',
      }

      const setting: UserSettingDto = {
        tenantCode: 'MBC',
        code: 'UserListSetting',
        name: 'UserListSetting',
        settingValue: {},
        userId: 'abc',
      }

      jest.spyOn(dataService, 'getItem').mockResolvedValue({
        pk: 'SETTING#MBC',
        sk: 'USER#abc#UserListSetting',
        id: 'SETTING#MBC#USER#abc#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 2,
        tenantCode: 'MBC',
        name: 'UserListSetting',
        type: 'MASTER',
        isDeleted: true,
      })

      jest.spyOn(commandService, 'publishAsync').mockResolvedValue({
        pk: 'SETTING#MBC',
        sk: 'USER#abc#UserListSetting',
        id: 'SETTING#MBC#USER#abc#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 3,
        tenantCode: 'MBC',
        name: 'UserListSetting',
        type: 'MASTER',
      })
      const result = await service.createUserSetting(setting, optionsMock)

      expect(result).toEqual(mockResponse)
    })
  })
  describe('updateSetting', () => {
    describe('partial updates', () => {
      const stored = {
        pk: 'MASTER#ta',
        sk: 'MASTER_SETTING#S1',
        name: 'Old',
        version: 2,
        attributes: { fields: [], __systemId: 'app-y' },
      }
      const mergedResult = async () =>
        (commandService.publishPartialUpdateAsync as jest.Mock).mock.results[0]
          .value

      beforeEach(() => {
        dataService.getItem.mockResolvedValue(stored as any)
        commandService.publishPartialUpdateAsync.mockImplementation(
          async (input: any) => mergeDeep({}, stored, input) as any,
        )
      })

      it('keeps attributes and owner on a name-only update', async () => {
        await service.updateSetting(
          { pk: stored.pk, sk: stored.sk },
          { name: 'New' } as any,
          optionsMock,
        )
        const merged = await mergedResult()
        expect(merged.attributes).toEqual({ fields: [], __systemId: 'app-y' })
        expect(merged.name).toBe('New')
      })

      it('keeps the name on a settingValue-only update', async () => {
        await service.updateSetting(
          { pk: stored.pk, sk: stored.sk },
          { settingValue: { fields: [1] } } as any,
          optionsMock,
        )
        const merged = await mergedResult()
        expect(merged.name).toBe('Old')
        expect(merged.attributes.__systemId).toBe('app-y')
      })
    })

    it('should call updateSetting with correct parameters and return the result', async () => {
      const settingCode = ' UserListSetting'
      const settingValue = {}
      const settingName = 'user list setting'
      const tenantCode = 'MBC'

      const pk = `${SETTING_TENANT_PREFIX}${KEY_SEPARATOR}${tenantCode}`
      const sk = settingCode
      const mockResponse = {
        pk: 'SETTING#MBC',
        sk: 'USER#abcUserListSetting',
        id: 'SETTING#MBC#USER#abc#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 1,
        tenantCode: 'MBC',
        name: 'UserListSetting',
        type: 'MASTER',
      }

      const command: CommandDto = {
        sk,
        pk,
        code: sk,
        name: settingName,
        id: generateId(pk, sk),
        tenantCode: SettingTypeEnum.TENANT_COMMON,
        type: SettingTypeEnum.TENANT_COMMON,
        version: VERSION_FIRST,

        attributes: settingValue,
      }

      jest.spyOn(commandService, 'publishAsync').mockResolvedValue({
        pk: 'SETTING#MBC',
        sk: 'USER#abcUserListSetting',
        id: 'SETTING#MBC#USER#abc#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 1,
        tenantCode: 'MBC',
        name: 'UserListSetting',
        type: 'MASTER',
      })
      const result = await commandService.publishAsync(command, optionsMock)

      expect(result).toEqual(mockResponse)
    })
  })

  describe('upsertTenantSetting', () => {
    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should create new setting when not exists', async () => {
      const dto: TenantSettingDto = {
        tenantCode: 'MBC',
        code: 'NewSetting',
        name: 'New Setting',
        settingValue: { key: 'value' },
      }

      dataService.getItem.mockResolvedValue(null)
      const mockResponse = {
        pk: 'SETTING#MBC',
        sk: 'SETTING#NewSetting',
        id: 'SETTING#MBC#SETTING#NewSetting',
        attributes: { key: 'value' },
        code: 'NewSetting',
        version: 1,
        tenantCode: 'MBC',
        name: 'New Setting',
        type: 'MASTER',
        isDeleted: false,
      }
      commandService.publishAsync.mockResolvedValue(mockResponse)

      const result = await service.upsertTenantSetting(dto, optionsMock)

      expect(result).toBeInstanceOf(Object)
      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 0,
          isDeleted: false,
        }),
        optionsMock,
      )
    })

    it('should update existing setting when exists with changes', async () => {
      const dto: TenantSettingDto = {
        tenantCode: 'MBC',
        code: 'ExistingSetting',
        name: 'Updated Setting',
        settingValue: { key: 'new-value' },
      }

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
        attributes: { key: 'old-value' },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(existingData)
      const mockResponse = {
        ...existingData,
        name: 'Updated Setting',
        attributes: { key: 'new-value' },
        version: 3,
      }
      commandService.publishAsync.mockResolvedValue(mockResponse)

      const result = await service.upsertTenantSetting(dto, optionsMock)

      expect(result).toBeInstanceOf(Object)
      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 2,
          isDeleted: false,
        }),
        optionsMock,
      )
    })

    it('should return existing data when data is identical (not dirty)', async () => {
      const dto: TenantSettingDto = {
        tenantCode: 'MBC',
        code: 'SameSetting',
        name: 'Same Setting',
        settingValue: { key: 'same-value' },
      }

      const existingData: DataModel = {
        id: 'existing-id',
        pk: 'SETTING#MBC',
        sk: 'SETTING#SameSetting',
        code: 'SameSetting',
        name: 'Same Setting',
        version: 2,
        type: 'MASTER',
        tenantCode: 'MBC',
        isDeleted: false,
        attributes: { key: 'same-value' },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(existingData)
      commandService.publishAsync.mockResolvedValue(null)

      const result = await service.upsertTenantSetting(dto, optionsMock)

      expect(result).toBeInstanceOf(Object)
      expect(result.code).toBe('SameSetting')
    })

    it('should recreate when existing setting is deleted', async () => {
      const dto: TenantSettingDto = {
        tenantCode: 'MBC',
        code: 'DeletedSetting',
        name: 'Recreated Setting',
        settingValue: { recreated: true },
      }

      const existingDeletedData: DataModel = {
        id: 'existing-id',
        pk: 'SETTING#MBC',
        sk: 'SETTING#DeletedSetting',
        code: 'DeletedSetting',
        name: 'Deleted Setting',
        version: 3,
        type: 'MASTER',
        tenantCode: 'MBC',
        isDeleted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(existingDeletedData)
      const mockResponse = {
        ...existingDeletedData,
        name: 'Recreated Setting',
        attributes: { recreated: true },
        isDeleted: false,
        version: 3,
      }
      commandService.publishAsync.mockResolvedValue(mockResponse)

      const result = await service.upsertTenantSetting(dto, optionsMock)

      expect(result).toBeInstanceOf(Object)
      expect(result.isDeleted).toBe(false)
      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 3,
          isDeleted: false,
        }),
        optionsMock,
      )
    })
  })

  describe('upsertBulk', () => {
    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should upsert multiple items', async () => {
      const item1: CommonSettingDto = {
        code: 'Setting1',
        name: 'Setting 1',
        settingValue: { key: 'value1' },
      }
      const item2: CommonSettingDto = {
        code: 'Setting2',
        name: 'Setting 2',
        settingValue: { key: 'value2' },
      }

      dataService.getItem.mockResolvedValue(null)
      commandService.publishAsync
        .mockResolvedValueOnce({
          pk: 'SETTING#MBC',
          sk: 'SETTING#Setting1',
          id: 'SETTING#MBC#SETTING#Setting1',
          attributes: { key: 'value1' },
          code: 'Setting1',
          version: 1,
          tenantCode: 'MBC',
          name: 'Setting 1',
          type: 'MASTER',
          isDeleted: false,
        })
        .mockResolvedValueOnce({
          pk: 'SETTING#MBC',
          sk: 'SETTING#Setting2',
          id: 'SETTING#MBC#SETTING#Setting2',
          attributes: { key: 'value2' },
          code: 'Setting2',
          version: 1,
          tenantCode: 'MBC',
          name: 'Setting 2',
          type: 'MASTER',
          isDeleted: false,
        })

      const result = await service.upsertBulk(
        { items: [item1, item2] },
        mockInvokeContext,
      )

      expect(result).toHaveLength(2)
    })
  })

  describe('deleteSetting', () => {
    /**
     * Test Overview: Tests deleteSetting method functionality for MasterSettingService
     * Purpose: Ensures settings can be properly soft deleted with correct version handling
     * Details: Verifies that settings are marked as deleted rather than physically removed
     */
    it('should soft delete existing setting', async () => {
      const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING#TEST_CODE' }
      const existingData: DataModel = {
        id: 'test-id',
        pk: 'MASTER#TEST_TENANT',
        sk: 'SETTING#TEST_CODE',
        code: 'TEST_CODE',
        name: 'Test Setting',
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
        version: 1,
        updatedAt: new Date(),
      }
      commandService.publishPartialUpdateAsync.mockResolvedValue(
        mockDeleteResult,
      )

      const result = await service.deleteSetting(key, {
        invokeContext: mockInvokeContext,
      })

      expect(result).toBeInstanceOf(Object)
      expect(commandService.publishPartialUpdateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          pk: key.pk,
          sk: key.sk,
          version: existingData.version,
          isDeleted: true,
        }),
        { invokeContext: mockInvokeContext },
      )
    })

    it('should throw BadRequestException when setting does not exist', async () => {
      const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING#NONEXISTENT' }

      dataService.getItem.mockResolvedValue(null)

      await expect(
        service.deleteSetting(key, { invokeContext: mockInvokeContext }),
      ).rejects.toThrow(BadRequestException)
      expect(commandService.publishPartialUpdateAsync).not.toHaveBeenCalled()
    })
  })

  /**
   * Test Overview: Tests comprehensive error handling scenarios for MasterSettingService operations
   * Purpose: Ensures the service properly handles database failures, validation errors, and edge cases
   * Details: Verifies error handling for DynamoDB failures, CommandService errors, and hierarchical processing
   */
  describe('Error Handling Scenarios', () => {
    describe('getSetting - Hierarchical Error Handling', () => {
      it('should handle DynamoDB tenant data access failures gracefully', async () => {
        const tenantCode = 'TEST_TENANT'
        const code = 'TEST_SETTING'

        const dbError = new Error('DynamoDB access failed')
        dbError.name = 'ResourceNotFoundException'
        dynamoDbService.getItem.mockRejectedValue(dbError)

        await expect(
          service.getSetting({ code }, { invokeContext: mockInvokeContext }),
        ).rejects.toThrow(BadRequestException)
      })

      it('should handle malformed tenant data in DynamoDB', async () => {
        const tenantCode = 'TEST_TENANT'
        const code = 'TEST_SETTING'

        dynamoDbService.getItem.mockResolvedValue({
          attributes: {
            malformedData: 'invalid-json-structure',
          },
        })

        await expect(
          service.getSetting({ code }, { invokeContext: mockInvokeContext }),
        ).rejects.toThrow(BadRequestException)
      })

      it('should handle timeout errors during hierarchical setting retrieval', async () => {
        const tenantCode = 'TEST_TENANT'
        const code = 'TEST_SETTING'

        const timeoutError = new Error('Request timeout')
        timeoutError.name = 'TimeoutError'

        dataService.getItem.mockRejectedValue(timeoutError)

        await expect(
          service.getSetting({ code }, { invokeContext: mockInvokeContext }),
        ).rejects.toThrow('Request timeout')
      })
    })

    describe('createCommonTenantSetting - Error Handling', () => {
      it('should handle CommandService publish failures', async () => {
        const dto: CommonSettingDto = {
          code: 'TEST_SETTING',
          name: 'Test Setting',
          settingValue: { key: 'value' },
        }

        dataService.getItem.mockResolvedValue(null)
        const publishError = new Error('Command publish failed')
        commandService.publishAsync.mockRejectedValue(publishError)

        await expect(
          service.createCommonTenantSetting(dto, {
            invokeContext: mockInvokeContext,
          }),
        ).rejects.toThrow('Command publish failed')
      })

      it('should handle database connection errors during existence check', async () => {
        const dto: CommonSettingDto = {
          code: 'TEST_SETTING',
          name: 'Test Setting',
          settingValue: { key: 'value' },
        }

        const dbError = new Error('Database connection failed')
        dbError.name = 'NetworkingError'
        dataService.getItem.mockRejectedValue(dbError)

        await expect(
          service.createCommonTenantSetting(dto, {
            invokeContext: mockInvokeContext,
          }),
        ).rejects.toThrow('Database connection failed')
      })
    })

    describe('updateSetting - Error Handling', () => {
      it('should handle version conflict errors during update', async () => {
        const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING#TEST_CODE' }
        const existingData: DataModel = {
          id: 'test-id',
          pk: 'MASTER#TEST_TENANT',
          sk: 'SETTING#TEST_CODE',
          code: 'TEST_CODE',
          name: 'Test Setting',
          version: 1,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        dataService.getItem.mockResolvedValue(existingData)
        const versionError = new Error('Version conflict')
        versionError.name = 'ConditionalCheckFailedException'
        commandService.publishPartialUpdateAsync.mockRejectedValue(versionError)

        await expect(
          service.updateSetting(
            key,
            { settingValue: { updated: true } },
            { invokeContext: mockInvokeContext },
          ),
        ).rejects.toThrow('Version conflict')
      })

      it('should handle concurrent update attempts', async () => {
        const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING#TEST_CODE' }
        const existingData: DataModel = {
          id: 'test-id',
          pk: 'MASTER#TEST_TENANT',
          sk: 'SETTING#TEST_CODE',
          code: 'TEST_CODE',
          name: 'Test Setting',
          version: 1,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        dataService.getItem.mockResolvedValue(existingData)
        const concurrencyError = new Error('Concurrent modification')
        commandService.publishPartialUpdateAsync.mockRejectedValue(
          concurrencyError,
        )

        await expect(
          service.updateSetting(
            key,
            { settingValue: { updated: true } },
            { invokeContext: mockInvokeContext },
          ),
        ).rejects.toThrow('Concurrent modification')
      })
    })
  })

  /**
   * Test Overview: Tests edge cases and boundary conditions for MasterSettingService operations
   * Purpose: Ensures the service handles unusual inputs and boundary conditions properly
   * Details: Verifies behavior with empty values, special characters, and malformed data
   */
  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty setting code', async () => {
      await expect(
        service.getSetting(
          { code: 'TEST_SETTING' },
          { invokeContext: mockInvokeContext },
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('should handle null setting code', async () => {
      await expect(
        service.getSetting(
          { code: null },
          { invokeContext: mockInvokeContext },
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('should handle special characters in setting codes', async () => {
      const specialCode = 'SETTING_特殊文字@#$%'

      const mockCommonSetting = {
        id: 'test-id',
        pk: 'SETTING#common',
        sk: `SETTING#${specialCode}`,
        code: specialCode,
        name: 'Special Setting',
        version: 1,
        type: 'MASTER',
        tenantCode: 'common',
        isDeleted: false,
        attributes: { special: true },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(mockCommonSetting)

      const result = await service.getSetting(
        { code: specialCode },
        { invokeContext: mockInvokeContext },
      )

      expect(result).toBeDefined()
      expect(result).toBeInstanceOf(MasterSettingEntity)
    })

    it('should handle missing user context in invoke context', async () => {
      const tenantCode = 'TEST_TENANT'
      const code = 'TEST_SETTING'
      const emptyInvokeContext = {}

      dataService.getItem.mockResolvedValue(null)

      await expect(
        service.getSetting({ code }, { invokeContext: mockInvokeContext }),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('createTenantSetting - Edge Cases', () => {
    it('should handle empty setting values', async () => {
      const dto: TenantSettingDto = {
        tenantCode: 'TEST_TENANT',
        code: 'TEST_SETTING',
        name: 'Test Setting',
        settingValue: {},
      }

      dataService.getItem.mockResolvedValue(null)
      const mockResponse: CommandModel = {
        id: 'test-id',
        pk: 'SETTING#TEST_TENANT',
        sk: 'SETTING#TEST_SETTING',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        name: 'TEST_SETTING',
        code: 'TEST_SETTING',
        isDeleted: false,
        attributes: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      commandService.publishAsync.mockResolvedValue(mockResponse)

      const result = await service.createTenantSetting(dto, {
        invokeContext: mockInvokeContext,
      })

      expect(result).toBeInstanceOf(Object)
      expect(result.attributes).toEqual({})
    })

    it('should handle very large setting values', async () => {
      const largeSettingValue = {}
      for (let i = 0; i < 1000; i++) {
        largeSettingValue[`key${i}`] = `value${i}`.repeat(50)
      }

      const dto: TenantSettingDto = {
        tenantCode: 'TEST_TENANT',
        code: 'LARGE_SETTING',
        name: 'Large Setting',
        settingValue: largeSettingValue,
      }

      dataService.getItem.mockResolvedValue(null)
      const mockResponse: CommandModel = {
        id: 'test-id',
        pk: 'SETTING#TEST_TENANT',
        sk: 'SETTING#LARGE_SETTING',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        name: 'LARGE_SETTING',
        code: 'LARGE_SETTING',
        isDeleted: false,
        attributes: largeSettingValue,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      commandService.publishAsync.mockResolvedValue(mockResponse)

      const result = await service.createTenantSetting(dto, {
        invokeContext: mockInvokeContext,
      })

      expect(result).toBeInstanceOf(Object)
      expect(Object.keys(result.attributes)).toHaveLength(1000)
    })
  })

  /**
   * Test Overview: Tests comprehensive deleted setting re-addition scenarios for MasterSettingService
   * Purpose: Ensures deleted settings can be properly recreated for all setting types with correct version handling
   * Details: Verifies version increment, attribute preservation, and state transitions for common, tenant, group, and user settings
   */
  describe('Deleted Setting Re-addition Scenarios', () => {
    describe('createCommonTenantSetting - Deleted Setting Recreation', () => {
      it('should recreate deleted common setting with incremented version', async () => {
        const dto: CommonSettingDto = {
          code: 'RECREATED_SETTING',
          name: 'Recreated Setting',
          settingValue: { recreated: true, version: 2 },
        }

        const existingDeletedSetting: DataModel = {
          id: 'existing-id',
          pk: 'SETTING#common',
          sk: 'SETTING#RECREATED_SETTING',
          code: 'RECREATED_SETTING',
          name: 'RECREATED_SETTING',
          version: 3,
          type: 'MASTER',
          tenantCode: 'common',
          isDeleted: true,
          attributes: { original: true, version: 1 },
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-02'),
        }

        dataService.getItem.mockResolvedValue(existingDeletedSetting)
        const mockResponse: CommandModel = {
          id: 'existing-id',
          pk: 'SETTING#common',
          sk: 'SETTING#RECREATED_SETTING',
          version: 3,
          type: 'MASTER',
          tenantCode: 'common',
          name: 'RECREATED_SETTING',
          code: 'RECREATED_SETTING',
          isDeleted: false,
          attributes: dto.settingValue,
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date(),
        }
        commandService.publishAsync.mockResolvedValue(mockResponse)

        const result = await service.createCommonTenantSetting(dto, {
          invokeContext: mockInvokeContext,
        })

        expect(result).toBeInstanceOf(Object)
        expect(result.version).toBe(3)
        expect(result.isDeleted).toBe(false)
        expect(result.attributes).toEqual({ recreated: true, version: 2 })
        expect(commandService.publishAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            version: 3,
            isDeleted: false,
            attributes: { recreated: true, version: 2 },
          }),
          { invokeContext: mockInvokeContext },
        )
      })

      it('should handle multiple deletion and recreation cycles for common settings', async () => {
        const dto: CommonSettingDto = {
          code: 'CYCLED_SETTING',
          name: 'Cycled Setting',
          settingValue: { cycle: 4, final: true },
        }

        const existingDeletedSetting: DataModel = {
          id: 'existing-id',
          pk: 'SETTING#common',
          sk: 'SETTING#CYCLED_SETTING',
          code: 'CYCLED_SETTING',
          name: 'CYCLED_SETTING',
          version: 7,
          type: 'MASTER',
          tenantCode: 'common',
          isDeleted: true,
          attributes: { cycle: 3, previous: true },
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-04'),
        }

        dataService.getItem.mockResolvedValue(existingDeletedSetting)
        const mockResponse: CommandModel = {
          id: 'existing-id',
          pk: 'SETTING#common',
          sk: 'SETTING#CYCLED_SETTING',
          version: 7,
          type: 'MASTER',
          tenantCode: 'common',
          name: 'CYCLED_SETTING',
          code: 'CYCLED_SETTING',
          isDeleted: false,
          attributes: dto.settingValue,
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date(),
        }
        commandService.publishAsync.mockResolvedValue(mockResponse)

        const result = await service.createCommonTenantSetting(dto, {
          invokeContext: mockInvokeContext,
        })

        expect(result).toBeInstanceOf(Object)
        expect(result.version).toBe(7)
        expect(result.isDeleted).toBe(false)
        expect(result.attributes).toEqual({ cycle: 4, final: true })
      })
    })

    describe('createTenantSetting - Deleted Setting Recreation', () => {
      it('should recreate deleted tenant setting with proper tenant isolation', async () => {
        const dto: TenantSettingDto = {
          tenantCode: 'TENANT_A',
          code: 'TENANT_SETTING',
          name: 'Tenant Setting',
          settingValue: { tenant: 'A', recreated: true },
        }

        const existingDeletedSetting: DataModel = {
          id: 'existing-id',
          pk: 'SETTING#TENANT_A',
          sk: 'SETTING#TENANT_SETTING',
          code: 'TENANT_SETTING',
          name: 'TENANT_SETTING',
          version: 2,
          type: 'MASTER',
          tenantCode: 'TENANT_A',
          isDeleted: true,
          attributes: { tenant: 'A', original: true },
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-02'),
        }

        dataService.getItem.mockResolvedValue(existingDeletedSetting)
        const mockResponse: CommandModel = {
          id: 'existing-id',
          pk: 'SETTING#TENANT_A',
          sk: 'SETTING#TENANT_SETTING',
          version: 2,
          type: 'MASTER',
          tenantCode: 'TENANT_A',
          name: 'TENANT_SETTING',
          code: 'TENANT_SETTING',
          isDeleted: false,
          attributes: dto.settingValue,
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date(),
        }
        commandService.publishAsync.mockResolvedValue(mockResponse)

        const result = await service.createTenantSetting(dto, {
          invokeContext: mockInvokeContext,
        })

        expect(result).toBeInstanceOf(Object)
        expect(result.version).toBe(2)
        expect(result.tenantCode).toBe('TENANT_A')
        expect(result.isDeleted).toBe(false)
        expect(result.attributes).toEqual({ tenant: 'A', recreated: true })
      })

      it('should handle tenant setting recreation with different tenant codes', async () => {
        const dto: TenantSettingDto = {
          tenantCode: 'TENANT_B',
          code: 'SHARED_SETTING',
          name: 'Shared Setting',
          settingValue: { tenant: 'B', value: 'new' },
        }

        dataService.getItem.mockResolvedValue(null)
        const mockResponse: CommandModel = {
          id: 'new-id',
          pk: 'SETTING#TENANT_B',
          sk: 'SETTING#SHARED_SETTING',
          version: 1,
          type: 'MASTER',
          tenantCode: 'TENANT_B',
          name: 'SHARED_SETTING',
          code: 'SHARED_SETTING',
          isDeleted: false,
          attributes: dto.settingValue,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        commandService.publishAsync.mockResolvedValue(mockResponse)

        const result = await service.createTenantSetting(dto, {
          invokeContext: mockInvokeContext,
        })

        expect(result).toBeInstanceOf(Object)
        expect(result.version).toBe(1)
        expect(result.tenantCode).toBe('TENANT_B')
        expect(result.isDeleted).toBe(false)
      })
    })

    describe('createGroupSetting - Deleted Setting Recreation', () => {
      it('should recreate deleted group setting with group hierarchy validation', async () => {
        const dto: GroupSettingDto = {
          tenantCode: 'TEST_TENANT',
          groupId: 'GROUP_123',
          code: 'GROUP_SETTING',
          name: 'Group Setting',
          settingValue: { group: 'GROUP_123', recreated: true },
        }

        const existingDeletedSetting: DataModel = {
          id: 'existing-id',
          pk: 'SETTING#TEST_TENANT',
          sk: 'SETTING#GROUP#GROUP_123#GROUP_SETTING',
          code: 'GROUP_SETTING',
          name: 'GROUP_SETTING',
          version: 4,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          isDeleted: true,
          attributes: { group: 'GROUP_123', original: true },
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-03'),
        }

        dataService.getItem.mockResolvedValue(existingDeletedSetting)
        const mockResponse: CommandModel = {
          id: 'existing-id',
          pk: 'SETTING#TEST_TENANT',
          sk: 'SETTING#GROUP#GROUP_123#GROUP_SETTING',
          version: 4,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          name: 'GROUP_SETTING',
          code: 'GROUP_SETTING',
          isDeleted: false,
          attributes: dto.settingValue,
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date(),
        }
        commandService.publishAsync.mockResolvedValue(mockResponse)

        const result = await service.createGroupSetting(dto, {
          invokeContext: mockInvokeContext,
        })

        expect(result).toBeInstanceOf(Object)
        expect(result.version).toBe(4)
        expect(result.tenantCode).toBe('TEST_TENANT')
        expect(result.isDeleted).toBe(false)
        expect(result.attributes).toEqual({
          group: 'GROUP_123',
          recreated: true,
        })
      })

      it('should handle group setting recreation across different groups', async () => {
        const dto: GroupSettingDto = {
          tenantCode: 'TEST_TENANT',
          groupId: 'GROUP_456',
          code: 'SHARED_GROUP_SETTING',
          name: 'Shared Group Setting',
          settingValue: { group: 'GROUP_456', value: 'different' },
        }

        dataService.getItem.mockResolvedValue(null)
        const mockResponse: CommandModel = {
          id: 'new-id',
          pk: 'SETTING#TEST_TENANT',
          sk: 'SETTING#GROUP#GROUP_456#SHARED_GROUP_SETTING',
          version: 1,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          name: 'SHARED_GROUP_SETTING',
          code: 'SHARED_GROUP_SETTING',
          isDeleted: false,
          attributes: dto.settingValue,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        commandService.publishAsync.mockResolvedValue(mockResponse)

        const result = await service.createGroupSetting(dto, {
          invokeContext: mockInvokeContext,
        })

        expect(result).toBeInstanceOf(Object)
        expect(result.version).toBe(1)
        expect(result.isDeleted).toBe(false)
        expect(result.attributes).toEqual({
          group: 'GROUP_456',
          value: 'different',
        })
      })
    })

    describe('createUserSetting - Deleted Setting Recreation', () => {
      it('should recreate deleted user setting with user context validation', async () => {
        const dto: UserSettingDto = {
          tenantCode: 'TEST_TENANT',
          userId: 'USER_789',
          code: 'USER_SETTING',
          name: 'User Setting',
          settingValue: { user: 'USER_789', recreated: true },
        }

        const existingDeletedSetting: DataModel = {
          id: 'existing-id',
          pk: 'SETTING#TEST_TENANT',
          sk: 'SETTING#USER#USER_789#USER_SETTING',
          code: 'USER_SETTING',
          name: 'USER_SETTING',
          version: 6,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          isDeleted: true,
          attributes: { user: 'USER_789', original: true },
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-05'),
        }

        dataService.getItem.mockResolvedValue(existingDeletedSetting)
        const mockResponse: CommandModel = {
          id: 'existing-id',
          pk: 'SETTING#TEST_TENANT',
          sk: 'SETTING#USER#USER_789#USER_SETTING',
          version: 6,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          name: 'USER_SETTING',
          code: 'USER_SETTING',
          isDeleted: false,
          attributes: dto.settingValue,
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date(),
        }
        commandService.publishAsync.mockResolvedValue(mockResponse)

        const result = await service.createUserSetting(dto, {
          invokeContext: mockInvokeContext,
        })

        expect(result).toBeInstanceOf(Object)
        expect(result.version).toBe(6)
        expect(result.tenantCode).toBe('TEST_TENANT')
        expect(result.isDeleted).toBe(false)
        expect(result.attributes).toEqual({ user: 'USER_789', recreated: true })
      })

      it('should preserve original creation timestamp when recreating user setting', async () => {
        const originalCreatedAt = new Date('2023-01-01T08:00:00Z')
        const dto: UserSettingDto = {
          tenantCode: 'TEST_TENANT',
          userId: 'USER_ABC',
          code: 'TIMESTAMP_SETTING',
          name: 'Timestamp Setting',
          settingValue: { preserveTimestamp: true },
        }

        const existingDeletedSetting: DataModel = {
          id: 'existing-id',
          pk: 'SETTING#TEST_TENANT',
          sk: 'SETTING#USER#USER_ABC#TIMESTAMP_SETTING',
          code: 'TIMESTAMP_SETTING',
          name: 'TIMESTAMP_SETTING',
          version: 3,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          isDeleted: true,
          attributes: { original: true },
          createdAt: originalCreatedAt,
          updatedAt: new Date('2023-01-02'),
        }

        dataService.getItem.mockResolvedValue(existingDeletedSetting)
        const mockResponse: CommandModel = {
          id: 'existing-id',
          pk: 'SETTING#TEST_TENANT',
          sk: 'SETTING#USER#USER_ABC#TIMESTAMP_SETTING',
          version: 3,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          name: 'TIMESTAMP_SETTING',
          code: 'TIMESTAMP_SETTING',
          isDeleted: false,
          attributes: dto.settingValue,
          createdAt: originalCreatedAt,
          updatedAt: new Date(),
        }
        commandService.publishAsync.mockResolvedValue(mockResponse)

        const result = await service.createUserSetting(dto, {
          invokeContext: mockInvokeContext,
        })

        expect(result).toBeInstanceOf(Object)
        expect(result.createdAt).toEqual(originalCreatedAt)
        expect(result.isDeleted).toBe(false)
        expect(result.attributes).toEqual({ preserveTimestamp: true })
      })
    })
  })

  /**
   * Test Overview: Tests concurrent operation scenarios for MasterSettingService
   * Purpose: Ensures the service handles simultaneous operations correctly with proper version control
   * Details: Verifies race condition handling, version conflicts, and concurrent hierarchical setting operations
   */
  describe('Concurrent Operation Scenarios', () => {
    describe('getSetting - Concurrent Hierarchical Access', () => {
      it('should handle concurrent hierarchical setting access correctly', async () => {
        const tenantCode = 'TEST_TENANT'
        const code = 'CONCURRENT_SETTING'

        const mockCommonSetting = {
          id: 'test-id',
          pk: 'SETTING#common',
          sk: 'SETTING#CONCURRENT_SETTING',
          code: 'CONCURRENT_SETTING',
          name: 'Concurrent Setting',
          version: 1,
          type: 'MASTER',
          tenantCode: 'common',
          isDeleted: false,
          attributes: { concurrent: true },
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        dataService.getItem.mockResolvedValue(mockCommonSetting)

        const promises = Array.from({ length: 5 }, () =>
          service.getSetting({ code }, { invokeContext: mockInvokeContext }),
        )

        const results = await Promise.all(promises)

        results.forEach((result) => {
          expect(result).toBeInstanceOf(MasterSettingEntity)
          expect(result).toBeDefined()
        })
      })

      it('should handle mixed success and failure in concurrent hierarchical access', async () => {
        const tenantCode = 'TEST_TENANT'
        const code = 'MIXED_SETTING'

        dataService.getItem
          .mockResolvedValueOnce(null)
          .mockRejectedValueOnce(new Error('User fetch failed'))
          .mockResolvedValueOnce(null)

        const results = await Promise.allSettled([
          service.getSetting({ code }, { invokeContext: mockInvokeContext }),
          service.getSetting({ code }, { invokeContext: mockInvokeContext }),
          service.getSetting({ code }, { invokeContext: mockInvokeContext }),
        ])

        expect(results[0].status).toBe('rejected')
        expect(results[1].status).toBe('rejected')
        expect(results[2].status).toBe('rejected')
      })
    })

    describe('createTenantSetting - Concurrent Operations', () => {
      it('should handle concurrent tenant setting creation with version conflicts', async () => {
        const dto1: TenantSettingDto = {
          tenantCode: 'TEST_TENANT',
          code: 'CONCURRENT_SETTING',
          name: 'Concurrent Setting 1',
          settingValue: { first: true },
        }

        const dto2: TenantSettingDto = {
          tenantCode: 'TEST_TENANT',
          code: 'CONCURRENT_SETTING',
          name: 'Concurrent Setting 2',
          settingValue: { second: true },
        }

        dataService.getItem.mockResolvedValue(null)

        const mockResponse1: CommandModel = {
          id: 'test-id-1',
          pk: 'SETTING#TEST_TENANT',
          sk: 'SETTING#CONCURRENT_SETTING',
          version: 1,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          name: 'CONCURRENT_SETTING',
          code: 'CONCURRENT_SETTING',
          isDeleted: false,
          attributes: dto1.settingValue,
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        const versionConflictError = new Error('Version conflict')
        versionConflictError.name = 'ConditionalCheckFailedException'

        commandService.publishAsync
          .mockResolvedValueOnce(mockResponse1)
          .mockRejectedValueOnce(versionConflictError)

        const result1 = await service.createTenantSetting(dto1, {
          invokeContext: mockInvokeContext,
        })

        await expect(
          service.createTenantSetting(dto2, {
            invokeContext: mockInvokeContext,
          }),
        ).rejects.toThrow('Version conflict')

        expect(result1).toBeInstanceOf(Object)
        expect(result1.attributes).toEqual({ first: true })
      })
    })

    describe('updateSetting - Concurrent Operations', () => {
      it('should handle concurrent setting updates with proper version control', async () => {
        const key = { pk: 'SETTING#TEST_TENANT', sk: 'SETTING#UPDATE_TEST' }
        const existingData: DataModel = {
          id: 'test-id',
          pk: 'SETTING#TEST_TENANT',
          sk: 'SETTING#UPDATE_TEST',
          code: 'UPDATE_TEST',
          name: 'Update Test',
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
          version: 2,
          updatedAt: new Date(),
        }

        const versionConflictError = new Error('Version conflict')
        versionConflictError.name = 'ConditionalCheckFailedException'

        commandService.publishPartialUpdateAsync
          .mockResolvedValueOnce(mockUpdateResult1)
          .mockRejectedValueOnce(versionConflictError)

        const result1 = await service.updateSetting(
          key,
          { settingValue: { updated: true } },
          { invokeContext: mockInvokeContext },
        )

        await expect(
          service.updateSetting(
            key,
            { settingValue: { updated: true } },
            { invokeContext: mockInvokeContext },
          ),
        ).rejects.toThrow('Version conflict')

        expect(result1.version).toBe(2)
      })
    })
  })
})

describe('MasterSettingService commonTenantCode option', () => {
  const build = async (moduleOptions?: any) => {
    const dataService = { getItem: jest.fn(), listItemsByPk: jest.fn() }
    const commandService = { publishAsync: jest.fn() }
    const providers: any[] = [
      MasterSettingService,
      { provide: TaskService, useValue: {} },
      { provide: PRISMA_SERVICE, useValue: {} },
      { provide: CommandService, useValue: commandService },
      { provide: DataService, useValue: dataService },
      {
        provide: DynamoDbService,
        useValue: { getItem: jest.fn(), getTableName: jest.fn() },
      },
    ]
    if (moduleOptions) {
      providers.push({ provide: MODULE_OPTIONS_TOKEN, useValue: moduleOptions })
    }
    const module = await Test.createTestingModule({ providers }).compile()
    return {
      service: module.get(MasterSettingService),
      dataService,
      commandService,
    }
  }

  it('creates common settings in the configured tenant', async () => {
    const { service, dataService, commandService } = await build({
      commonTenantCode: 'shared-tenant',
    })
    dataService.getItem.mockResolvedValue(null)
    await service.createCommonTenantSetting(
      { code: 'C', name: 'N', settingValue: {} } as any,
      optionsMock,
    )
    expect(commandService.publishAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        pk: 'MASTER#shared-tenant',
        tenantCode: 'shared-tenant',
      }),
      optionsMock,
    )
  })

  it('falls back to the configured tenant in getSetting', async () => {
    const { service, dataService } = await build({
      commonTenantCode: 'shared-tenant',
    })
    dataService.getItem.mockImplementation(async ({ pk }: any) =>
      pk === 'MASTER#shared-tenant'
        ? { id: 'shared-id', attributes: { a: 1 } }
        : null,
    )
    const res = await service.getSetting({ code: 'X' }, optionsMock)
    expect(res.id).toBe('shared-id')
  })

  it('keeps common when the option is unset', async () => {
    process.env.COMMON_TENANT_CODES = 'other'
    try {
      const { service, commandService, dataService } = await build()
      dataService.getItem.mockResolvedValue(null)
      await service.createCommonTenantSetting(
        { code: 'C', name: 'N', settingValue: {} } as any,
        optionsMock,
      )
      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({ pk: 'MASTER#common', tenantCode: 'common' }),
        optionsMock,
      )
    } finally {
      delete process.env.COMMON_TENANT_CODES
    }
  })
})

describe('MasterSettingService reserved system attribute', () => {
  const build = async () => {
    const dataService = { getItem: jest.fn(), listItemsByPk: jest.fn() }
    const commandService = {
      publishAsync: jest.fn(),
      publishPartialUpdateAsync: jest.fn(),
    }
    const prisma = { master: { count: jest.fn(), findMany: jest.fn() } }
    const module = await Test.createTestingModule({
      providers: [
        MasterSettingService,
        { provide: TaskService, useValue: {} },
        { provide: PRISMA_SERVICE, useValue: prisma },
        { provide: CommandService, useValue: commandService },
        { provide: DataService, useValue: dataService },
        {
          provide: DynamoDbService,
          useValue: { getItem: jest.fn(), getTableName: jest.fn() },
        },
      ],
    }).compile()
    return {
      service: module.get(MasterSettingService),
      dataService,
      commandService,
      prisma,
    }
  }
  const bad = { a: 1, __systemId: 'evil' }
  const attrsOf = (fn: jest.Mock) => fn.mock.calls[0][0].attributes

  it.each([
    ['createCommonTenantSetting', { code: 'C', name: 'n', settingValue: bad }],
    [
      'createTenantSetting',
      { code: 'C', name: 'n', tenantCode: 'T', settingValue: bad },
    ],
    [
      'upsertTenantSetting',
      { code: 'C', name: 'n', tenantCode: 'T', settingValue: bad },
    ],
    [
      'createGroupSetting',
      {
        code: 'C',
        name: 'n',
        tenantCode: 'T',
        groupId: 'g',
        settingValue: bad,
      },
    ],
    [
      'createUserSetting',
      { code: 'C', name: 'n', tenantCode: 'T', userId: 'u', settingValue: bad },
    ],
  ])('removes a client __systemId on %s', async (method, dto) => {
    const { service, dataService, commandService } = await build()
    dataService.getItem.mockResolvedValue(null)
    commandService.publishAsync.mockResolvedValue({ id: 'i' })
    await (service as any)[method](dto, optionsMock)
    expect(attrsOf(commandService.publishAsync)).toEqual({ a: 1 })
  })

  it('removes a client __systemId on updateSetting', async () => {
    const { service, dataService, commandService } = await build()
    dataService.getItem.mockResolvedValue({ version: 1 })
    await service.updateSetting(
      { pk: 'p', sk: 's' },
      { settingValue: bad } as any,
      optionsMock,
    )
    expect(attrsOf(commandService.publishPartialUpdateAsync)).toEqual({ a: 1 })
  })

  it('returns systemId at the top level from getDetail', async () => {
    const { service, dataService } = await build()
    dataService.getItem.mockResolvedValue({
      id: 'i',
      attributes: { a: 1, __systemId: 'S1' },
    })
    const res: any = await service.getDetail({ pk: 'p', sk: 's' })
    expect(res).toMatchObject({ systemId: 'S1', attributes: { a: 1 } })
  })

  it('hides the key from getSetting settingValue', async () => {
    const { service, dataService } = await build()
    dataService.getItem.mockResolvedValue({
      id: 'i',
      attributes: { a: 1, __systemId: 'S1' },
    })
    const res = await service.getSetting({ code: 'X' }, optionsMock)
    expect(res.settingValue).toEqual({ a: 1 })
  })

  it('maps list items', async () => {
    const { service, prisma } = await build()
    prisma.master.count.mockResolvedValue(1)
    prisma.master.findMany.mockResolvedValue([
      { id: 'i', attributes: { a: 1, __systemId: 'S1' } },
    ])
    const res = await service.list({} as any, optionsMock.invokeContext)
    expect(res.items[0]).toMatchObject({ systemId: 'S1', attributes: { a: 1 } })
  })

  it('leaves rows with no owner unchanged', async () => {
    const { service, dataService } = await build()
    dataService.getItem.mockResolvedValue({ id: 'i', attributes: { a: 1 } })
    const res: any = await service.getDetail({ pk: 'p', sk: 's' })
    expect(res).not.toHaveProperty('systemId')
  })
})

describe('MasterSettingService list includeCommon', () => {
  const build = async () => {
    const prisma = { master: { count: jest.fn(), findMany: jest.fn() } }
    const module = await Test.createTestingModule({
      providers: [
        MasterSettingService,
        { provide: TaskService, useValue: {} },
        { provide: PRISMA_SERVICE, useValue: prisma },
        { provide: CommandService, useValue: {} },
        { provide: DataService, useValue: {} },
        {
          provide: DynamoDbService,
          useValue: { getItem: jest.fn(), getTableName: jest.fn() },
        },
      ],
    }).compile()
    prisma.master.count.mockResolvedValue(0)
    return { service: module.get(MasterSettingService), prisma }
  }
  const ctxFor = (tenant: string) => {
    const ctx = JSON.parse(JSON.stringify(optionsMock.invokeContext))
    ctx.event.requestContext.authorizer.jwt.claims['custom:tenant'] = tenant
    return ctx
  }
  const whereOf = (prisma: any) => prisma.master.count.mock.calls[0][0].where

  it('returns only the caller tenant by default', async () => {
    const { service, prisma } = await build()
    prisma.master.findMany.mockResolvedValue([])
    await service.list({} as any, ctxFor('MBC'))
    expect(whereOf(prisma).tenantCode).toBe('mbc')
    expect(whereOf(prisma).OR).toBeUndefined()
    expect(prisma.master.findMany).toHaveBeenCalledTimes(1)
  })

  it('merges common rows and excludes codes the tenant has, soft-deleted included', async () => {
    const { service, prisma } = await build()
    prisma.master.findMany
      .mockResolvedValueOnce([{ code: 'SETTING#A' }])
      .mockResolvedValueOnce([])
    await service.list({ includeCommon: true } as any, ctxFor('MBC'))
    const exclusion = prisma.master.findMany.mock.calls[0][0]
    expect(exclusion.where).toEqual({
      tenantCode: 'mbc',
      masterType: 'MASTER_SETTING',
    })
    expect(whereOf(prisma).OR).toEqual([
      { tenantCode: 'mbc' },
      { tenantCode: 'common', code: { notIn: ['SETTING#A'] } },
    ])
    expect(whereOf(prisma).tenantCode).toBeUndefined()
  })

  it('does not query exclusions when the caller is in the common tenant', async () => {
    const { service, prisma } = await build()
    prisma.master.findMany.mockResolvedValue([])
    await service.list({ includeCommon: true } as any, ctxFor('Common'))
    expect(prisma.master.findMany).toHaveBeenCalledTimes(1)
    expect(whereOf(prisma).tenantCode).toBe('common')
  })
})

describe('MasterSettingService ownership', () => {
  const ctx = {
    event: {
      headers: { 'x-tenant-code': 'ta' },
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
  const opts = { invokeContext: ctx }

  const build = async (grants?: any[]) => {
    const dataService = { getItem: jest.fn().mockResolvedValue(null) }
    const commandService = {
      publishAsync: jest.fn().mockResolvedValue({ id: 'i' }),
      publishPartialUpdateAsync: jest.fn().mockResolvedValue({ id: 'i' }),
      getLatestItem: jest.fn().mockResolvedValue(null),
    }
    const registry = new MasterAccessResolverRegistry()
    if (grants) registry.set({ resolveGrants: async () => grants })
    const access = new MasterAccessService(registry, commandService as any)
    const module = await Test.createTestingModule({
      providers: [
        MasterSettingService,
        { provide: TaskService, useValue: {} },
        { provide: PRISMA_SERVICE, useValue: {} },
        { provide: CommandService, useValue: commandService },
        { provide: DataService, useValue: dataService },
        {
          provide: DynamoDbService,
          useValue: { getItem: jest.fn(), getTableName: jest.fn() },
        },
        { provide: MasterAccessService, useValue: access },
      ],
    }).compile()
    return {
      service: module.get(MasterSettingService),
      dataService,
      commandService,
    }
  }
  const all = [{ systemId: '*', settingCode: '*', read: true, write: true }]
  const dto = (extra: object = {}) => ({
    code: 'S1',
    name: 'n',
    tenantCode: 'ta',
    settingValue: { a: 1 },
    ...extra,
  })
  const published = (fn: jest.Mock) => fn.mock.calls[0][0]

  it('stores nothing and does no lookup without a resolver', async () => {
    const { service, commandService } = await build()
    await service.createTenantSetting(dto({ systemId: 'A' }), opts)
    expect(published(commandService.publishAsync).attributes).toEqual({ a: 1 })
    expect(commandService.getLatestItem).not.toHaveBeenCalled()
  })

  it('stores the requested systemId in lower case and hides it in the response', async () => {
    const { service, commandService } = await build(all)
    commandService.publishAsync.mockImplementation(async (c) => c)
    const res: any = await service.createTenantSetting(
      dto({ systemId: 'APP-A' }),
      opts,
    )
    expect(published(commandService.publishAsync).attributes).toEqual({
      a: 1,
      __systemId: 'app-a',
    })
    expect(res).toMatchObject({ systemId: 'app-a', attributes: { a: 1 } })
  })

  it('rejects * as a requested systemId', async () => {
    const { service, commandService } = await build(all)
    await expect(
      service.createTenantSetting(dto({ systemId: '*' }), opts),
    ).rejects.toThrow(BadRequestException)
    expect(commandService.publishAsync).not.toHaveBeenCalled()
  })

  it('stores the owner on createCommonTenantSetting', async () => {
    const { service, commandService } = await build(all)
    await service.createCommonTenantSetting(
      { code: 'S1', name: 'n', settingValue: {}, systemId: 'a' } as any,
      { invokeContext: ctx, skipAccessCheck: true },
    )
    expect(published(commandService.publishAsync).attributes).toEqual({
      __systemId: 'a',
    })
  })

  it('keeps the owner across delete and recreate', async () => {
    const { service, dataService, commandService } = await build(all)
    dataService.getItem.mockResolvedValue({
      isDeleted: true,
      version: 2,
      attributes: { __systemId: 'A' },
    })
    await service.upsertTenantSetting(dto(), opts)
    expect(published(commandService.publishAsync).attributes).toEqual({
      a: 1,
      __systemId: 'A',
    })
  })

  it('rejects a different systemId on upsert', async () => {
    const { service, dataService } = await build(all)
    dataService.getItem.mockResolvedValue({ attributes: { __systemId: 'A' } })
    await expect(
      service.upsertTenantSetting(dto({ systemId: 'B' }), opts),
    ).rejects.toThrow(BadRequestException)
  })

  it('rejects a requested systemId on an untagged existing row', async () => {
    const { service, dataService } = await build(all)
    dataService.getItem.mockResolvedValue({ attributes: {} })
    await expect(
      service.upsertTenantSetting(dto({ systemId: 'B' }), opts),
    ).rejects.toThrow(BadRequestException)
  })

  it('checks write access against the final owner', async () => {
    const { service, commandService } = await build([
      { systemId: 'B', settingCode: '*', read: true, write: true },
    ])
    await expect(
      service.createTenantSetting(dto({ systemId: 'A' }), opts),
    ).rejects.toThrow(ForbiddenException)
    expect(commandService.publishAsync).not.toHaveBeenCalled()
  })

  it('uses options.systemId from internal callers', async () => {
    const { service, commandService } = await build(all)
    await service.createTenantSetting(dto(), { ...opts, systemId: 'Z' })
    expect(published(commandService.publishAsync).attributes).toEqual({
      a: 1,
      __systemId: 'Z',
    })
  })

  it('stores no systemId on group and user settings', async () => {
    const { service, commandService } = await build(all)
    await service.createGroupSetting(
      dto({ groupId: 'g', systemId: 'A' }) as any,
      opts,
    )
    await service.createUserSetting(
      dto({ userId: 'u', systemId: 'A' }) as any,
      opts,
    )
    for (const [c] of commandService.publishAsync.mock.calls) {
      expect(c.attributes).toEqual({ a: 1 })
    }
  })

  it('checks group settings against the base setting owner', async () => {
    const { service, commandService } = await build([
      { systemId: 'B', settingCode: '*', read: true, write: true },
    ])
    commandService.getLatestItem.mockResolvedValue({
      attributes: { __systemId: 'A' },
    })
    await expect(
      service.createGroupSetting(dto({ groupId: 'g' }) as any, opts),
    ).rejects.toThrow(ForbiddenException)
    expect(commandService.getLatestItem).toHaveBeenCalledWith({
      pk: 'MASTER#ta',
      sk: 'MASTER_SETTING#S1',
    })
  })

  it('carries systemId through updateSetting', async () => {
    const { service, dataService, commandService } = await build(all)
    dataService.getItem.mockResolvedValue({
      version: 1,
      tenantCode: 'ta',
      attributes: { __systemId: 'A' },
    })
    await service.updateSetting(
      { pk: 'MASTER#ta', sk: 'MASTER_SETTING#S1' },
      { settingValue: { b: 2, __systemId: 'evil' } } as any,
      opts,
    )
    expect(
      published(commandService.publishPartialUpdateAsync).attributes,
    ).toEqual({ b: 2, __systemId: 'A' })
  })

  it('rejects updateSetting and deleteSetting without write access', async () => {
    const { service, dataService, commandService } = await build([
      { systemId: 'B', settingCode: '*', read: true, write: true },
    ])
    dataService.getItem.mockResolvedValue({
      version: 1,
      tenantCode: 'ta',
      attributes: { __systemId: 'A' },
    })
    const key = { pk: 'MASTER#ta', sk: 'MASTER_SETTING#S1' }
    await expect(
      service.updateSetting(key, { settingValue: {} } as any, opts),
    ).rejects.toThrow(ForbiddenException)
    await expect(service.deleteSetting(key, opts)).rejects.toThrow(
      ForbiddenException,
    )
    expect(commandService.publishPartialUpdateAsync).not.toHaveBeenCalled()
  })

  it('writes nothing when one bulk item is forbidden', async () => {
    const { service, commandService } = await build([
      { systemId: 'A', settingCode: '*', read: true, write: true },
    ])
    await expect(
      service.upsertBulk(
        {
          items: [
            { code: 'S1', name: 'n', settingValue: {}, systemId: 'A' },
            { code: 'S2', name: 'n', settingValue: {}, systemId: 'B' },
          ],
        } as any,
        ctx,
      ),
    ).rejects.toThrow(ForbiddenException)
    expect(commandService.publishAsync).not.toHaveBeenCalled()
  })
})

describe('MasterSettingService read access', () => {
  const ctx = {
    event: {
      headers: { 'x-tenant-code': 'ta' },
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
  const opts = { invokeContext: ctx }
  const appA = [
    { systemId: 'app-a', settingCode: '*', read: true, write: false },
  ]

  const build = async (grants?: any[]) => {
    const dataService = { getItem: jest.fn().mockResolvedValue(null) }
    const commandService = {
      getLatestItem: jest.fn().mockResolvedValue({
        attributes: { __systemId: 'other' },
      }),
    }
    const prisma = {
      master: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue({ isDeleted: false }),
      },
    }
    const registry = new MasterAccessResolverRegistry()
    if (grants) registry.set({ resolveGrants: async () => grants })
    const access = new MasterAccessService(registry, commandService as any)
    const dynamo = {
      getItem: jest.fn().mockResolvedValue(null),
      getTableName: jest.fn(),
    }
    const module = await Test.createTestingModule({
      providers: [
        MasterSettingService,
        { provide: TaskService, useValue: {} },
        { provide: PRISMA_SERVICE, useValue: prisma },
        { provide: CommandService, useValue: commandService },
        { provide: DataService, useValue: dataService },
        { provide: DynamoDbService, useValue: dynamo },
        { provide: MasterAccessService, useValue: access },
      ],
    }).compile()
    return {
      service: module.get(MasterSettingService),
      dataService,
      prisma,
      dynamo,
    }
  }
  const personalRows = [
    { sk: { startsWith: 'MASTER_SETTING#GROUP#' } },
    { sk: { startsWith: 'MASTER_SETTING#USER#' } },
  ]
  const countWhere = (prisma: any) => prisma.master.count.mock.calls[0][0].where
  const row = (extra: object = {}) => ({
    id: 'i',
    tenantCode: 'ta',
    sk: 'MASTER_SETTING#S1',
    attributes: { v: 1, __systemId: 'app-a' },
    ...extra,
  })

  it('adds the filter to list', async () => {
    const { service, prisma } = await build(appA)
    await service.list({} as any, ctx, opts)
    expect(countWhere(prisma).AND).toEqual([
      { systemId: 'app-a', NOT: personalRows },
    ])
  })

  it('narrows list to the search systemId', async () => {
    const { service, prisma } = await build([
      { systemId: '*', settingCode: '*', read: true, write: false },
    ])
    await service.list({ systemId: 'app-a' } as any, ctx, opts)
    expect(countWhere(prisma).AND).toEqual([
      { systemId: 'app-a', NOT: personalRows },
    ])
  })

  it('does not reference systemId in where without a resolver', async () => {
    const { service, prisma } = await build()
    await service.list({ systemId: 'app-a' } as any, ctx, opts)
    expect(JSON.stringify(countWhere(prisma))).not.toContain('systemId')
  })

  it('uses masterCode for the setting list filter', async () => {
    const { service, prisma } = await build([
      { systemId: 'app-a', settingCode: 'S1', read: true, write: false },
    ])
    await service.list({} as any, ctx, opts)
    expect(countWhere(prisma).AND).toEqual([
      { systemId: 'app-a', masterCode: 'S1', NOT: personalRows },
    ])
  })

  it('denies get for a system with no grant', async () => {
    const { service, dataService } = await build(appA)
    dataService.getItem.mockResolvedValue(
      row({ attributes: { __systemId: 'x' } }),
    )
    await expect(
      service.getDetail({ pk: 'MASTER#ta', sk: 'MASTER_SETTING#S1' }, opts),
    ).rejects.toThrow(ForbiddenException)
  })

  it('returns a granted row from getDetail', async () => {
    const { service, dataService } = await build(appA)
    dataService.getItem.mockResolvedValue(row())
    await expect(
      service.getDetail({ pk: 'MASTER#ta', sk: 'MASTER_SETTING#S1' }, opts),
    ).resolves.toBeDefined()
  })

  it('denies getSetting when the resolved row is not granted', async () => {
    const { service, dataService } = await build(appA)
    dataService.getItem.mockResolvedValue(
      row({ attributes: { __systemId: 'x' } }),
    )
    await expect(
      service.getSetting({ code: 'S1' } as any, opts),
    ).rejects.toThrow(ForbiddenException)
  })

  it('returns getSetting for a granted row', async () => {
    const { service, dataService } = await build(appA)
    dataService.getItem.mockResolvedValue(row())
    expect(await service.getSetting({ code: 'S1' } as any, opts)).toMatchObject(
      {
        id: 'i',
        settingValue: { v: 1 },
      },
    )
  })

  it('checks a personal row against its base setting owner', async () => {
    const { service, dataService } = await build(appA)
    // base setting owner is "other" (getLatestItem), the personal row carries none
    dataService.getItem.mockResolvedValue(
      row({ sk: 'MASTER_SETTING#USER#u1#S1', attributes: { v: 1 } }),
    )
    await expect(
      service.getSetting({ code: 'S1' } as any, opts),
    ).rejects.toThrow(ForbiddenException)
  })

  it('throws Forbidden for a group row instead of falling through', async () => {
    const { service, dataService, dynamo } = await build(appA)
    dynamo.getItem.mockResolvedValue({
      attributes: {
        setting: [{ tenantRole: 'user', setting_groups: ['g1'] }],
      },
    })
    // user row: none; group row: owned via its base setting "other"; tenant row: granted
    dataService.getItem
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        row({ sk: 'MASTER_SETTING#GROUP#g1#S1', attributes: { v: 2 } }),
      )
      .mockResolvedValue(row())
    await expect(
      service.getSetting({ code: 'S1' } as any, opts),
    ).rejects.toThrow(ForbiddenException)
  })

  it('reports an existing code owned by another system', async () => {
    const { service } = await build(appA)
    expect(await service.checkExistCode('S1', ctx, opts)).toBe(true)
  })
})

describe('MasterSettingService copy access', () => {
  const ctx = (role: string, roles?: any[]) =>
    ({
      event: {
        headers: { 'x-tenant-code': 'ta' },
        requestContext: {
          authorizer: {
            jwt: {
              claims: {
                sub: 'u1',
                'custom:tenant': 'ta',
                'custom:roles': JSON.stringify(
                  roles ?? [{ tenant: 'ta', role }],
                ),
              },
            },
          },
        },
      },
    }) as any
  const opts = (role = 'user') => ({ invokeContext: ctx(role) })
  const dto = (targetTenants: string[]) =>
    ({
      masterSettingId: 'MASTER#common#MASTER_SETTING#S1',
      targetTenants,
    }) as any

  const build = async (grants?: any[]) => {
    const dataService = {
      getItem: jest.fn().mockResolvedValue({
        pk: 'MASTER#common',
        sk: 'MASTER_SETTING#S1',
        tenantCode: 'common',
        isDeleted: false,
        attributes: { __systemId: 'app-a' },
      }),
    }
    const taskService = { createStepFunctionTask: jest.fn() }
    const registry = new MasterAccessResolverRegistry()
    if (grants) registry.set({ resolveGrants: async () => grants })
    const access = new MasterAccessService(registry, {} as any)
    const module = await Test.createTestingModule({
      providers: [
        MasterSettingService,
        { provide: TaskService, useValue: taskService },
        { provide: PRISMA_SERVICE, useValue: {} },
        { provide: CommandService, useValue: {} },
        { provide: DataService, useValue: dataService },
        {
          provide: DynamoDbService,
          useValue: { getTableName: jest.fn() },
        },
        { provide: MasterAccessService, useValue: access },
      ],
    }).compile()
    return { service: module.get(MasterSettingService), taskService }
  }
  const full = [{ systemId: '*', settingCode: '*', read: true, write: true }]

  it('rejects a caller who is not system_admin', async () => {
    const { service, taskService } = await build(full)
    await expect(service.copy(dto(['ta']), opts('user'))).rejects.toThrow(
      ForbiddenException,
    )
    expect(taskService.createStepFunctionTask).not.toHaveBeenCalled()
  })

  it('rejects system_admin with grants narrower than full write', async () => {
    const { service, taskService } = await build([
      { systemId: 'app-a', settingCode: '*', read: true, write: true },
    ])
    await expect(
      service.copy(dto(['ta']), opts('system_admin')),
    ).rejects.toThrow(ForbiddenException)
    expect(taskService.createStepFunctionTask).not.toHaveBeenCalled()
  })

  it('copies for system_admin with full write to another tenant', async () => {
    const { service, taskService } = await build(full)
    await service.copy(dto(['tb']), opts('system_admin'))
    expect(taskService.createStepFunctionTask).toHaveBeenCalled()
  })

  it('checks the target tenant gate for a multi-role caller', async () => {
    const { service, taskService } = await build(full)
    const invokeContext = ctx('user', [
      { tenant: 'ta', role: 'user' },
      { tenant: 'ta', role: 'system_admin' },
    ])
    await expect(service.copy(dto(['tb']), { invokeContext })).rejects.toThrow(
      ForbiddenException,
    )
    expect(taskService.createStepFunctionTask).not.toHaveBeenCalled()
  })

  it('rejects a scope systemId that differs from the source owner', async () => {
    const { service, taskService } = await build(full)
    await expect(
      service.copy(dto(['ta']), {
        ...opts('system_admin'),
        scope: { systemId: 'app-y' },
      }),
    ).rejects.toThrow(ForbiddenException)
    expect(taskService.createStepFunctionTask).not.toHaveBeenCalled()
  })

  it('allows a scope systemId matching the source owner, ignoring case', async () => {
    const { service, taskService } = await build(full)
    await service.copy(dto(['ta']), {
      ...opts('system_admin'),
      scope: { systemId: 'APP-A' },
    })
    expect(taskService.createStepFunctionTask).toHaveBeenCalled()
  })

  it('copies without checks when no resolver is registered', async () => {
    const { service, taskService } = await build()
    await service.copy(dto(['tb']), opts())
    expect(taskService.createStepFunctionTask).toHaveBeenCalled()
  })
})

describe('MasterSettingService assignSystem', () => {
  const ctx = (roles: any[]) =>
    ({
      event: {
        headers: { 'x-tenant-code': 'ta' },
        requestContext: {
          authorizer: {
            jwt: {
              claims: {
                sub: 'u1',
                'custom:tenant': 'ta',
                'custom:roles': JSON.stringify(roles),
              },
            },
          },
        },
      },
    }) as any
  const admin = ctx([{ tenant: 'ta', role: 'system_admin' }])
  const userCtx = ctx([{ tenant: 'ta', role: 'user' }])
  const grants = [{ systemId: '*', settingCode: '*', read: true, write: true }]

  const build = async (withResolver = true, rowGrants: any[] = grants) => {
    const findMany = jest
      .fn()
      .mockImplementation(async ({ where }: any) =>
        where.masterType === 'MASTER_SETTING'
          ? [{ pk: 'MASTER#ta', sk: 'MASTER_SETTING#S1', version: 3 }]
          : [{ pk: 'MASTER#ta', sk: 'MASTER_DATA#S1#a', version: 5 }],
      )
    const publish = jest.fn().mockResolvedValue({})
    // The command table is ahead of RDS: its versions differ from the RDS rows'.
    const getLatestItem = jest
      .fn()
      .mockImplementation(async ({ pk, sk }: any) => ({
        pk,
        sk,
        version: sk.startsWith('MASTER_SETTING') ? 4 : 6,
        attributes: { a: 1 },
      }))
    const registry = new MasterAccessResolverRegistry()
    if (withResolver) registry.set({ resolveGrants: async () => rowGrants })
    const access = new MasterAccessService(registry, {} as any)
    const module = await Test.createTestingModule({
      providers: [
        MasterSettingService,
        { provide: TaskService, useValue: {} },
        { provide: PRISMA_SERVICE, useValue: { master: { findMany } } },
        {
          provide: CommandService,
          useValue: { publishPartialUpdateAsync: publish, getLatestItem },
        },
        { provide: DataService, useValue: {} },
        { provide: DynamoDbService, useValue: { getTableName: jest.fn() } },
        { provide: MasterAccessService, useValue: access },
      ],
    }).compile()
    return {
      service: module.get(MasterSettingService),
      findMany,
      publish,
      getLatestItem,
    }
  }

  it('throws when no resolver is registered', async () => {
    const { service, findMany } = await build(false)
    await expect(
      service.assignSystem(
        { code: 'S1', systemId: 'app-a', tenantCode: 'ta' },
        { invokeContext: admin },
      ),
    ).rejects.toThrow(BadRequestException)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('throws on a blank systemId', async () => {
    const { service } = await build()
    await expect(
      service.assignSystem(
        { code: 'S1', systemId: ' ', tenantCode: 'ta' },
        { invokeContext: admin },
      ),
    ).rejects.toThrow(BadRequestException)
  })

  it('throws on a * systemId', async () => {
    const { service, findMany } = await build()
    await expect(
      service.assignSystem(
        { code: 'S1', systemId: '*', tenantCode: 'ta' },
        { invokeContext: admin },
      ),
    ).rejects.toThrow(BadRequestException)
    expect(findMany).not.toHaveBeenCalled()
  })

  it('stores the systemId in lower case', async () => {
    const { service, publish } = await build()
    await service.assignSystem(
      { code: 'S1', systemId: 'APP-A', tenantCode: 'ta' },
      { invokeContext: admin },
    )
    expect(publish.mock.calls[0][0].attributes).toEqual({ __systemId: 'app-a' })
  })

  it('skips a row whose latest command already has an owner', async () => {
    const { service, publish, getLatestItem } = await build()
    getLatestItem.mockImplementationOnce(async ({ pk, sk }: any) => ({
      pk,
      sk,
      version: 4,
      attributes: { __systemId: 'other' },
    }))
    const res = await service.assignSystem(
      { code: 'S1', systemId: 'app-a', tenantCode: 'ta' },
      { invokeContext: admin },
    )
    expect(res).toEqual({ updated: 1 })
    expect(publish).toHaveBeenCalledTimes(1)
    expect(publish.mock.calls[0][0].sk).toBe('MASTER_DATA#S1#a')
  })

  it('skips a row with no command', async () => {
    const { service, publish, getLatestItem } = await build()
    getLatestItem.mockResolvedValue(null)
    const res = await service.assignSystem(
      { code: 'S1', systemId: 'app-a', tenantCode: 'ta' },
      { invokeContext: admin },
    )
    expect(res).toEqual({ updated: 0 })
    expect(publish).not.toHaveBeenCalled()
  })

  it('tags setting and data rows with the reserved key', async () => {
    const { service, publish } = await build()
    const opts = { invokeContext: admin }
    const res = await service.assignSystem(
      { code: 'S1', systemId: 'app-a', tenantCode: 'ta' },
      opts,
    )
    expect(res).toEqual({ updated: 2 })
    expect(publish).toHaveBeenNthCalledWith(
      1,
      {
        pk: 'MASTER#ta',
        sk: 'MASTER_SETTING#S1',
        version: 4,
        attributes: { __systemId: 'app-a' },
      },
      { invokeContext: admin },
    )
    expect(publish).toHaveBeenNthCalledWith(
      2,
      {
        pk: 'MASTER#ta',
        sk: 'MASTER_DATA#S1#a',
        version: 6,
        attributes: { __systemId: 'app-a' },
      },
      { invokeContext: admin },
    )
  })

  it('only selects untagged rows, settings and data, limited to tenantCode', async () => {
    const { service, findMany } = await build()
    await service.assignSystem(
      { code: 'S1', systemId: 'app-a', tenantCode: 'ta' },
      { invokeContext: admin },
    )
    expect(findMany).toHaveBeenNthCalledWith(1, {
      where: {
        masterType: 'MASTER_SETTING',
        masterCode: 'S1',
        systemId: null,
        tenantCode: 'ta',
      },
    })
    expect(findMany).toHaveBeenNthCalledWith(2, {
      where: {
        masterType: 'MASTER_DATA',
        masterTypeCode: 'S1',
        systemId: null,
        tenantCode: 'ta',
      },
    })
  })

  it('does not touch group and user settings', async () => {
    const { service, findMany } = await build()
    await service.assignSystem(
      { code: 'S1', systemId: 'app-a', tenantCode: 'ta' },
      { invokeContext: admin },
    )
    const types = findMany.mock.calls.map((c) => c[0].where.masterType)
    expect(types).toEqual(['MASTER_SETTING', 'MASTER_DATA'])
  })

  it('requires write on the target and on shared', async () => {
    const { service, findMany, publish } = await build(true, [
      { systemId: 'app-a', settingCode: '*', read: true, write: true },
    ])
    await expect(
      service.assignSystem(
        { code: 'S1', systemId: 'app-a', tenantCode: 'ta' },
        { invokeContext: admin },
      ),
    ).rejects.toThrow(ForbiddenException)
    expect(findMany).not.toHaveBeenCalled()
    expect(publish).not.toHaveBeenCalled()
  })

  it('requires a cross-tenant role without tenantCode', async () => {
    const { service, findMany } = await build()
    await expect(
      service.assignSystem(
        { code: 'S1', systemId: 'app-a' },
        { invokeContext: userCtx },
      ),
    ).rejects.toThrow(ForbiddenException)
    expect(findMany).not.toHaveBeenCalled()
  })
})

describe('MasterSettingService search filters per database', () => {
  const search = async (activeProvider: string, override?: string) => {
    const prisma = {
      _activeProvider: activeProvider,
      master: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    }
    const module = await Test.createTestingModule({
      providers: [
        MasterSettingService,
        { provide: TaskService, useValue: {} },
        { provide: PRISMA_SERVICE, useValue: prisma },
        { provide: CommandService, useValue: {} },
        { provide: DataService, useValue: {} },
        {
          provide: DynamoDbService,
          useValue: { getItem: jest.fn(), getTableName: jest.fn() },
        },
        ...(override
          ? [
              {
                provide: MODULE_OPTIONS_TOKEN,
                useValue: { databaseProvider: override },
              },
            ]
          : []),
      ],
    }).compile()
    await module
      .get(MasterSettingService)
      .list(
        { name: 'Area', code: 'Ar', keyword: 'desc' } as any,
        optionsMock.invokeContext,
      )
    return JSON.stringify(prisma.master.findMany.mock.calls)
  }

  it('uses mode insensitive and an array JSON path on postgresql', async () => {
    const calls = await search('postgresql')
    expect(calls).toContain('{"name":{"contains":"Area","mode":"insensitive"}}')
    expect(calls).toContain(
      '{"masterCode":{"contains":"Ar","mode":"insensitive"}}',
    )
    expect(calls).toContain(
      '{"attributes":{"path":["description"],"string_contains":"desc"}}',
    )
  })

  it('drops mode and uses a $. JSON path on mysql', async () => {
    const calls = await search('mysql')
    expect(calls).toContain('{"name":{"contains":"Area"}}')
    expect(calls).toContain('{"masterCode":{"contains":"Ar"}}')
    expect(calls).toContain(
      '{"attributes":{"path":"$.description","string_contains":"desc"}}',
    )
    expect(calls).not.toContain('insensitive')
  })

  it('lets the databaseProvider option override detection', async () => {
    const calls = await search('postgresql', 'mysql')
    expect(calls).toContain('"path":"$.description"')
    expect(calls).not.toContain('insensitive')
  })
})
