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
import { TaskService } from '@mbc-cqrs-serverless/task'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { createMock } from '@golevelup/ts-jest'
import { 
  DataModel, 
  CommandModel, 
  DetailKey,
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
    dataService = module.get<DataService>(DataService) as jest.Mocked<DataService>
    commandService = module.get<CommandService>(CommandService) as jest.Mocked<CommandService>
    dynamoDbService = module.get<DynamoDbService>(DynamoDbService) as jest.Mocked<DynamoDbService>
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
      commandService.publishPartialUpdateAsync.mockResolvedValue(mockDeleteResult)

      const result = await service.deleteSetting(key, { invokeContext: mockInvokeContext })

      expect(result).toBeInstanceOf(Object)
      expect(commandService.publishPartialUpdateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          pk: key.pk,
          sk: key.sk,
          version: existingData.version,
          isDeleted: true,
        }),
        { invokeContext: mockInvokeContext }
      )
    })

    it('should throw BadRequestException when setting does not exist', async () => {
      const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING#NONEXISTENT' }

      dataService.getItem.mockResolvedValue(null)

      await expect(service.deleteSetting(key, { invokeContext: mockInvokeContext }))
        .rejects.toThrow(BadRequestException)
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

        await expect(service.getSetting({ code }, { invokeContext: mockInvokeContext }))
          .rejects.toThrow(BadRequestException)
      })

      it('should handle malformed tenant data in DynamoDB', async () => {
        const tenantCode = 'TEST_TENANT'
        const code = 'TEST_SETTING'

        dynamoDbService.getItem.mockResolvedValue({
          attributes: {
            malformedData: 'invalid-json-structure'
          }
        })

        await expect(service.getSetting({ code }, { invokeContext: mockInvokeContext }))
          .rejects.toThrow(BadRequestException)
      })

      it('should handle timeout errors during hierarchical setting retrieval', async () => {
        const tenantCode = 'TEST_TENANT'
        const code = 'TEST_SETTING'

        const timeoutError = new Error('Request timeout')
        timeoutError.name = 'TimeoutError'
        
        dataService.getItem.mockRejectedValue(timeoutError)

        await expect(service.getSetting({ code }, { invokeContext: mockInvokeContext }))
          .rejects.toThrow('Request timeout')
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

        await expect(service.createCommonTenantSetting(dto, { invokeContext: mockInvokeContext }))
          .rejects.toThrow('Command publish failed')
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

        await expect(service.createCommonTenantSetting(dto, { invokeContext: mockInvokeContext }))
          .rejects.toThrow('Database connection failed')
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

        await expect(service.updateSetting(key, { settingValue: { updated: true } }, { invokeContext: mockInvokeContext }))
          .rejects.toThrow('Version conflict')
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
        commandService.publishPartialUpdateAsync.mockRejectedValue(concurrencyError)

        await expect(service.updateSetting(key, { settingValue: { updated: true } }, { invokeContext: mockInvokeContext }))
          .rejects.toThrow('Concurrent modification')
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
        await expect(service.getSetting({ code: 'TEST_SETTING' }, { invokeContext: mockInvokeContext }))
          .rejects.toThrow(BadRequestException)
      })

      it('should handle null setting code', async () => {
        await expect(service.getSetting({ code: null }, { invokeContext: mockInvokeContext }))
          .rejects.toThrow(BadRequestException)
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

        const result = await service.getSetting({ code: specialCode }, { invokeContext: mockInvokeContext })

        expect(result).toBeDefined()
        expect(result).toBeInstanceOf(MasterSettingEntity)
      })

      it('should handle missing user context in invoke context', async () => {
        const tenantCode = 'TEST_TENANT'
        const code = 'TEST_SETTING'
        const emptyInvokeContext = {}

        dataService.getItem.mockResolvedValue(null)

        await expect(service.getSetting({ code }, { invokeContext: mockInvokeContext }))
          .rejects.toThrow(BadRequestException)
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

        const result = await service.createTenantSetting(dto, { invokeContext: mockInvokeContext })

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

        const result = await service.createTenantSetting(dto, { invokeContext: mockInvokeContext })

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

        const result = await service.createCommonTenantSetting(dto, { invokeContext: mockInvokeContext })

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
          { invokeContext: mockInvokeContext }
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

        const result = await service.createCommonTenantSetting(dto, { invokeContext: mockInvokeContext })

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

        const result = await service.createTenantSetting(dto, { invokeContext: mockInvokeContext })

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

        const result = await service.createTenantSetting(dto, { invokeContext: mockInvokeContext })

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

        const result = await service.createGroupSetting(dto, { invokeContext: mockInvokeContext })

        expect(result).toBeInstanceOf(Object)
        expect(result.version).toBe(4)
        expect(result.tenantCode).toBe('TEST_TENANT')
        expect(result.isDeleted).toBe(false)
        expect(result.attributes).toEqual({ group: 'GROUP_123', recreated: true })
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

        const result = await service.createGroupSetting(dto, { invokeContext: mockInvokeContext })

        expect(result).toBeInstanceOf(Object)
        expect(result.version).toBe(1)
        expect(result.isDeleted).toBe(false)
        expect(result.attributes).toEqual({ group: 'GROUP_456', value: 'different' })
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

        const result = await service.createUserSetting(dto, { invokeContext: mockInvokeContext })

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

        const result = await service.createUserSetting(dto, { invokeContext: mockInvokeContext })

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
          service.getSetting({ code }, { invokeContext: mockInvokeContext })
        )

        const results = await Promise.all(promises)
        
        results.forEach(result => {
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
          service.getSetting({ code }, { invokeContext: mockInvokeContext })
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

        const result1 = await service.createTenantSetting(dto1, { invokeContext: mockInvokeContext })
        
        await expect(service.createTenantSetting(dto2, { invokeContext: mockInvokeContext }))
          .rejects.toThrow('Version conflict')

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

        const result1 = await service.updateSetting(key, { settingValue: { updated: true } }, { invokeContext: mockInvokeContext })
        
        await expect(service.updateSetting(key, { settingValue: { updated: true } }, { invokeContext: mockInvokeContext }))
          .rejects.toThrow('Version conflict')

        expect(result1.version).toBe(2)
      })
    })
  })
})
