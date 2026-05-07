import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { DetailDto, IInvoke } from '@mbc-cqrs-serverless/core'

import { MasterSettingController } from './master-setting.controller'
import { MasterSettingService } from '../services/master-setting.service'

describe('MasterSettingController', () => {
  let controller: MasterSettingController
  let service: MasterSettingService

  const mockInvokeContext: IInvoke = {
    event: {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: 'test-sub',
              iss: 'test-issuer',
              'cognito:username': 'test-user',
              aud: 'test-audience',
              event_id: 'test-event-id',
              token_use: 'id',
              auth_time: 1699930911,
              name: 'Test User',
              'custom:tenant': 'test-tenant',
              exp: 1700017311,
              email: 'test@example.com',
              iat: 1699930911,
              jti: 'test-jti',
            },
          },
        },
      },
    },
  }

  beforeEach(async () => {
    const mockMasterSettingService = {
      getSetting: jest.fn(),
      createUserSetting: jest.fn(),
      createBulk: jest.fn(),
      upsertBulk: jest.fn(),
      updateSetting: jest.fn(),
      deleteSetting: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MasterSettingController],
      providers: [
        {
          provide: MasterSettingService,
          useValue: mockMasterSettingService,
        },
      ],
    }).compile()

    controller = module.get<MasterSettingController>(MasterSettingController)
    service = module.get<MasterSettingService>(MasterSettingService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('getSettingDetail', () => {
    it('should get setting detail successfully', async () => {
      const getDto = { code: 'TEST_SETTING' }
      const expectedResult = {
        pk: 'MASTER#test-tenant',
        sk: 'TEST_SETTING',
        settingCode: 'TEST_SETTING',
        name: 'Test Setting',
        type: 'TEXT',
        version: 1,
      }

      jest.spyOn(service, 'getSetting').mockResolvedValue(expectedResult as any)

      const result = await controller.getSettingDetail(
        getDto as any,
        mockInvokeContext,
      )

      expect(service.getSetting).toHaveBeenCalledWith(getDto, {
        invokeContext: mockInvokeContext,
      })
      expect(result).toEqual(expectedResult)
    })

    it('should handle service errors', async () => {
      const getDto = { code: 'TEST_SETTING' }
      const error = new Error('Setting not found')

      jest.spyOn(service, 'getSetting').mockRejectedValue(error)

      await expect(
        controller.getSettingDetail(getDto as any, mockInvokeContext),
      ).rejects.toThrow('Setting not found')
    })
  })

  describe('createUserSetting', () => {
    it('should create user setting successfully', async () => {
      const createDto = {
        name: 'New Setting',
        code: 'NEW_SETTING',
        tenantCode: 'test-tenant',
        settingValue: { type: 'TEXT', defaultValue: 'test' },
      }
      const expectedResult = {
        pk: 'test-tenant#master-setting',
        sk: 'NEW_SETTING',
        settingCode: 'NEW_SETTING',
        name: 'New Setting',
        type: 'TEXT',
        version: 1,
      }

      jest
        .spyOn(service, 'createUserSetting')
        .mockResolvedValue(expectedResult as any)

      const result = await controller.createUserSetting(
        mockInvokeContext,
        createDto,
      )

      expect(service.createUserSetting).toHaveBeenCalledWith(createDto, {
        invokeContext: mockInvokeContext,
      })
      expect(result).toEqual(expectedResult)
    })

    it('should handle creation errors', async () => {
      const createDto = {
        name: 'New Setting',
        code: 'NEW_SETTING',
        tenantCode: 'test-tenant',
        settingValue: { type: 'TEXT', defaultValue: 'test' },
      }
      const error = new BadRequestException('Invalid setting data')

      jest.spyOn(service, 'createUserSetting').mockRejectedValue(error)

      await expect(
        controller.createUserSetting(mockInvokeContext, createDto),
      ).rejects.toThrow('Invalid setting data')
    })
  })

  describe('createBulk', () => {
    it('should call upsertBulk', async () => {
      const createDto = {
        items: [
          {
            code: 'Setting1',
            name: 'Setting 1',
            settingValue: { key: 'value1' },
          },
        ],
      }
      const expectedResult = [
        {
          pk: 'SETTING#MBC',
          sk: 'SETTING#Setting1',
          id: 'SETTING#MBC#SETTING#Setting1',
          attributes: { key: 'value1' },
          code: 'Setting1',
          version: 1,
          tenantCode: 'MBC',
          name: 'Setting 1',
          type: 'MASTER',
        },
      ]

      jest.spyOn(service, 'upsertBulk').mockResolvedValue(expectedResult as any)

      const result = await controller.createBulk(
        createDto as any,
        mockInvokeContext,
      )

      expect(service.upsertBulk).toHaveBeenCalledWith(
        createDto,
        mockInvokeContext,
      )
      expect(result).toEqual(expectedResult)
    })
  })

  describe('updateTenant', () => {
    it('should update tenant setting successfully', async () => {
      const key: DetailDto = { pk: 'MASTER#test-tenant', sk: 'test-sk' }
      const updateDto = { name: 'Updated Setting' }
      const expectedResult = {
        pk: 'MASTER#test-tenant',
        sk: 'test-sk',
        name: 'Updated Setting',
        version: 2,
      }

      jest
        .spyOn(service, 'updateSetting')
        .mockResolvedValue(expectedResult as any)

      const result = await controller.updateTenant(
        key,
        updateDto as any,
        mockInvokeContext,
      )

      expect(service.updateSetting).toHaveBeenCalledWith(key, updateDto, {
        invokeContext: mockInvokeContext,
      })
      expect(result).toEqual(expectedResult)
    })

    it('should handle update errors', async () => {
      const key: DetailDto = { pk: 'MASTER#test-tenant', sk: 'test-sk' }
      const updateDto = { name: 'Updated Setting' }
      const error = new Error('Update failed')

      jest.spyOn(service, 'updateSetting').mockRejectedValue(error)

      await expect(
        controller.updateTenant(key, updateDto as any, mockInvokeContext),
      ).rejects.toThrow('Update failed')
    })
  })

  describe('deleteTenant', () => {
    it('should delete tenant setting successfully', async () => {
      const key: DetailDto = { pk: 'MASTER#test-tenant', sk: 'test-sk' }
      const expectedResult = {
        pk: 'MASTER#test-tenant',
        sk: 'test-sk',
        isDeleted: true,
        version: 2,
      }

      jest
        .spyOn(service, 'deleteSetting')
        .mockResolvedValue(expectedResult as any)

      const result = await controller.deleteTenant(key, mockInvokeContext)

      expect(service.deleteSetting).toHaveBeenCalledWith(key, {
        invokeContext: mockInvokeContext,
      })
      expect(result).toEqual(expectedResult)
    })

    it('should handle deletion errors', async () => {
      const key: DetailDto = { pk: 'MASTER#test-tenant', sk: 'test-sk' }
      const error = new Error('Deletion failed')

      jest.spyOn(service, 'deleteSetting').mockRejectedValue(error)

      await expect(
        controller.deleteTenant(key, mockInvokeContext),
      ).rejects.toThrow('Deletion failed')
    })
  })
})
