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
import { PRISMA_SERVICE } from '../master.module-definition'

const optionsMock = {
  invokeContext: {
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
  },
}

describe('SettingService', () => {
  let service: MasterSettingService
  let dataService: DataService
  let commandService: CommandService
  let dynamoDbService: DynamoDbService
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MasterSettingService,
        {
          provide: PRISMA_SERVICE,
          useValue: {},
        },
        {
          provide: CommandService,
          useValue: {
            publishAsync: jest.fn(),
          },
        },
        {
          provide: CommandService,
          useValue: {
            publishAsync: jest.fn(),
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
    dataService = module.get<DataService>(DataService)
    commandService = module.get<CommandService>(CommandService)
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
      id: 'SETTING#COMMON#CommonListSetting',
      settingValue: {},
    })

    const response = await service.getSetting(
      { code: 'CommonListSetting' },
      optionsMock,
    )

    expect(response).toEqual(
      new MasterSettingEntity({
        id: 'SETTING#COMMON#CommonListSetting',
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
        pk: 'SETTING#COMMON',
        sk: 'UserListSetting',
        id: 'SETTING#COMMON#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 1,
        tenantCode: 'COMMON',
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
        pk: 'SETTING#COMMON',
        sk: 'UserListSetting',
        id: 'SETTING#COMMON#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 1,
        tenantCode: 'COMMON',
        name: 'UserListSetting',
        type: 'MASTER',
      })
      const result = await commandService.publishAsync(command, optionsMock)

      expect(result).toEqual(mockResponse)
    })
    it('should create a new common setting', async () => {
      const mockResponse = {
        pk: 'SETTING#COMMON',
        sk: 'UserListSetting',
        id: 'SETTING#COMMON#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 1,
        tenantCode: 'COMMON',
        name: 'UserListSetting',
        type: 'MASTER',
      }

      const setting: CommonSettingDto = {
        code: 'UserListSetting',
        name: 'UserListSetting',
        settingValue: {},
      }

      jest.spyOn(commandService, 'publishAsync').mockResolvedValue({
        pk: 'SETTING#COMMON',
        sk: 'UserListSetting',
        id: 'SETTING#COMMON#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 1,
        tenantCode: 'COMMON',
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
        pk: 'SETTING#COMMON',
        sk: 'UserListSetting',
        id: 'SETTING#COMMON#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 3,
        tenantCode: 'COMMON',
        name: 'UserListSetting',
        type: 'MASTER',
      }

      const setting: CommonSettingDto = {
        code: 'UserListSetting',
        name: 'UserListSetting',
        settingValue: {},
      }

      jest.spyOn(dataService, 'getItem').mockResolvedValue({
        pk: 'SETTING#COMMON',
        sk: 'UserListSetting',
        id: 'SETTING#COMMON#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 2,
        tenantCode: 'COMMON',
        name: 'UserListSetting',
        type: 'MASTER',
        isDeleted: true,
      })

      jest.spyOn(commandService, 'publishAsync').mockResolvedValue({
        pk: 'SETTING#COMMON',
        sk: 'UserListSetting',
        id: 'SETTING#COMMON#UserListSetting',
        attributes: {},
        code: 'UserListSetting',
        version: 3,
        tenantCode: 'COMMON',
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

  describe('deleteSetting', () => {})
})
