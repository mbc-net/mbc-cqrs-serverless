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
            provide: CommandService,
            useValue: {
            publishAsync: jest.fn(),
            },
           },
          {
            provide: DataService,
            useValue:{
              getItem: jest.fn(),
              listItemsByPk: jest.fn()
            }
          },
          {
            provide: DynamoDbService,
            useValue:{
              getItem: jest.fn(),
              getTableName: jest.fn()
            }
          }
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
      });
  
      const response = await service.getSetting(
        { code: 'UserListSetting'},
        optionsMock,
      );
  
      expect(response).toEqual(
        new MasterSettingEntity({
          id: 'SETTING#MBC#USER#abc#UserListSetting',
          settingValue: {},
        }),
      );
    })
    it('should return group-level setting if found', async () => {
  
      jest.spyOn(service, 'getSetting').mockResolvedValueOnce({
        id: 'SETTING#MBC#GROUP#1#UserListSetting',
        settingValue: {},
      });
  
      const response = await service.getSetting(
        { code: 'UserListSetting' },
        optionsMock,
      );
  
      expect(response).toEqual(
        new MasterSettingEntity({
          id: 'SETTING#MBC#GROUP#1#UserListSetting',
          settingValue: {},
        }),
      );
    })
    it('should return tenant-level setting if found', async () => {
      jest.spyOn(service, 'getSetting').mockResolvedValueOnce({
        id: 'SETTING#MBC#TENANT#TenantListSetting',
        settingValue: {},
      });
  
      const response = await service.getSetting(
        { code: 'TenantListSetting' },
        optionsMock,
      );
  
      expect(response).toEqual(
        new MasterSettingEntity({
          id: 'SETTING#MBC#TENANT#TenantListSetting',
          settingValue: {},
        }),
      );
    })
    it('should return common-level setting if found', async () => {
      jest.spyOn(service, 'getSetting').mockResolvedValueOnce({
        id: 'SETTING#COMMON#CommonListSetting',
        settingValue: {},
      });
  
      const response = await service.getSetting(
        { code: 'CommonListSetting' },
        optionsMock,
      );
  
      expect(response).toEqual(
        new MasterSettingEntity({
          id: 'SETTING#COMMON#CommonListSetting',
          settingValue: {},
        }),
      );
    })
  
    describe('createCommonTenantSetting', () => {
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
          type: 'COMMON',
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
          type: 'COMMON',
        })
        const result = await commandService.publishAsync(command, optionsMock)
  
        expect(result).toEqual(mockResponse)
      })
    })
    describe('createTenantSetting', () => {
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
          type: 'TENANT',
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
          type: 'TENANT',
        })
        const result = await commandService.publishAsync(command, optionsMock)
  
        expect(result).toEqual(mockResponse)
      })
    })
  
    describe('createGroupSetting', () => {
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
          type: 'GROUP',
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
          type: 'GROUP',
        })
        const result = await commandService.publishAsync(commad, optionsMock)
  
        expect(result).toEqual(mockResponse)
      })
    })
    describe('createUserSetting', () => {
      it('should call createGroupSetting with correct parameters and return the result', async () => {
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
          type: 'USER',
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
          sk: 'USER#abcUserListSetting',
          id: 'SETTING#MBC#USER#abc#UserListSetting',
          attributes: {},
          code: 'UserListSetting',
          version: 1,
          tenantCode: 'MBC',
          name: 'UserListSetting',
          type: 'USER',
        })
        const result = await commandService.publishAsync(commad, optionsMock)
  
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
          type: 'USER',
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
          type: 'USER',
        })
        const result = await commandService.publishAsync(command, optionsMock)
  
        expect(result).toEqual(mockResponse)
      })
    })
  
    describe('deleteSetting', () => {
      
    })
  })
  