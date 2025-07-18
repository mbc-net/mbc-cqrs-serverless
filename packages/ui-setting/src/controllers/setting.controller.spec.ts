import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { DetailDto, IInvoke } from '@mbc-cqrs-serverless/core'

import { SettingController } from './setting.controller'
import { SettingService } from '../services/setting.service'
import { CreateSettingDto } from '../dto/setting-create.dto'
import { UpdateSettingDto } from '../dto/setting-update.dto'

describe('SettingController', () => {
  let controller: SettingController
  let service: SettingService

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
    const mockSettingService = {
      list: jest.fn(),
      get: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      checkExistSettingCode: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingController],
      providers: [
        {
          provide: SettingService,
          useValue: mockSettingService,
        },
      ],
    }).compile()

    controller = module.get<SettingController>(SettingController)
    service = module.get<SettingService>(SettingService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('listData', () => {
    it('should list settings successfully', async () => {
      const expectedResult = [
        {
          pk: 'SETTING#test-tenant',
          sk: 'SETTING1',
          code: 'SETTING1',
          name: 'Test Setting 1',
          attributes: { type: 'TEXT' },
          version: 1,
        },
      ]

      jest.spyOn(service, 'list').mockResolvedValue(expectedResult as any)

      const result = await controller.listData(mockInvokeContext)

      expect(service.list).toHaveBeenCalledWith('test-tenant')
      expect(result).toEqual(expectedResult)
    })

    it('should handle service errors', async () => {
      const error = new Error('List failed')

      jest.spyOn(service, 'list').mockRejectedValue(error)

      await expect(controller.listData(mockInvokeContext)).rejects.toThrow('List failed')
    })
  })

  describe('getDetail', () => {
    it('should get setting detail successfully', async () => {
      const dto: DetailDto = { pk: 'SETTING#test-tenant', sk: 'TEST_SETTING' }
      const expectedResult = {
        pk: 'SETTING#test-tenant',
        sk: 'TEST_SETTING',
        code: 'TEST_SETTING',
        name: 'Test Setting',
        attributes: {
          description: 'Test setting attributes',
          fields: [
            {
              physicalName: 'test_field',
              name: 'Test Field',
              dataType: 'TEXT',
              defaultValue: 'test',
              isRequired: false,
              isShowedOnList: true,
            },
          ],
        },
        version: 1,
      }

      jest.spyOn(service, 'get').mockResolvedValue(expectedResult as any)

      const result = await controller.getDetail(mockInvokeContext, dto)

      expect(service.get).toHaveBeenCalledWith(dto)
      expect(result).toEqual(expectedResult)
    })

    it('should handle invalid tenant code', async () => {
      const dto: DetailDto = { pk: 'SETTING#other-tenant', sk: 'TEST_SETTING' }

      await expect(controller.getDetail(mockInvokeContext, dto)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('should handle service errors', async () => {
      const dto: DetailDto = { pk: 'SETTING#test-tenant', sk: 'TEST_SETTING' }
      const error = new Error('Setting not found')

      jest.spyOn(service, 'get').mockRejectedValue(error)

      await expect(controller.getDetail(mockInvokeContext, dto)).rejects.toThrow(
        'Setting not found',
      )
    })
  })

  describe('createSetting', () => {
    it('should create setting successfully', async () => {
      const createDto: CreateSettingDto = {
        name: 'New Setting',
        code: 'NEW_SETTING',
        attributes: {
          description: 'Test setting attributes',
          fields: [
            {
              physicalName: 'test_field',
              name: 'Test Field',
              dataType: 'TEXT',
              defaultValue: 'test',
              isRequired: false,
              isShowedOnList: true,
            },
          ],
        },
      }
      const expectedResult = {
        pk: 'SETTING#test-tenant',
        sk: 'NEW_SETTING',
        code: 'NEW_SETTING',
        name: 'New Setting',
        attributes: {
          description: 'Test setting attributes',
          fields: [
            {
              physicalName: 'test_field',
              name: 'Test Field',
              dataType: 'TEXT',
              defaultValue: 'test',
              isRequired: false,
              isShowedOnList: true,
            },
          ],
        },
        version: 1,
      }

      jest.spyOn(service, 'create').mockResolvedValue(expectedResult as any)

      const result = await controller.createSetting(mockInvokeContext, createDto)

      expect(service.create).toHaveBeenCalledWith('test-tenant', createDto, {
        invokeContext: mockInvokeContext,
      })
      expect(result).toEqual(expectedResult)
    })

    it('should handle creation errors', async () => {
      const createDto: CreateSettingDto = {
        name: 'New Setting',
        code: 'NEW_SETTING',
        attributes: {
          description: 'Test setting attributes',
          fields: [
            {
              physicalName: 'test_field',
              name: 'Test Field',
              dataType: 'TEXT',
              defaultValue: 'test',
              isRequired: false,
              isShowedOnList: true,
            },
          ],
        },
      }
      const error = new Error('Creation failed')

      jest.spyOn(service, 'create').mockRejectedValue(error)

      await expect(
        controller.createSetting(mockInvokeContext, createDto),
      ).rejects.toThrow('Creation failed')
    })
  })

  describe('updateSetting', () => {
    it('should update setting successfully', async () => {
      const key: DetailDto = { pk: 'SETTING#test-tenant', sk: 'TEST_SETTING' }
      const updateDto: UpdateSettingDto = { name: 'Updated Setting' }
      const expectedResult = {
        pk: 'SETTING#test-tenant',
        sk: 'TEST_SETTING',
        code: 'TEST_SETTING',
        name: 'Updated Setting',
        attributes: {
          description: 'Test setting attributes',
          fields: [
            {
              physicalName: 'test_field',
              name: 'Test Field',
              dataType: 'TEXT',
              defaultValue: 'test',
              isRequired: false,
              isShowedOnList: true,
            },
          ],
        },
        version: 2,
      }

      jest.spyOn(service, 'update').mockResolvedValue(expectedResult as any)

      const result = await controller.updateSetting(mockInvokeContext, key, updateDto)

      expect(service.update).toHaveBeenCalledWith(key, updateDto, {
        invokeContext: mockInvokeContext,
      })
      expect(result).toEqual(expectedResult)
    })

    it('should handle invalid tenant code', async () => {
      const key: DetailDto = { pk: 'SETTING#other-tenant', sk: 'TEST_SETTING' }
      const updateDto: UpdateSettingDto = { name: 'Updated Setting' }

      await expect(
        controller.updateSetting(mockInvokeContext, key, updateDto),
      ).rejects.toThrow(BadRequestException)
    })

    it('should handle update errors', async () => {
      const key: DetailDto = { pk: 'SETTING#test-tenant', sk: 'TEST_SETTING' }
      const updateDto: UpdateSettingDto = { name: 'Updated Setting' }
      const error = new Error('Update failed')

      jest.spyOn(service, 'update').mockRejectedValue(error)

      await expect(
        controller.updateSetting(mockInvokeContext, key, updateDto),
      ).rejects.toThrow('Update failed')
    })
  })

  describe('deleteSetting', () => {
    it('should delete setting successfully', async () => {
      const key: DetailDto = { pk: 'SETTING#test-tenant', sk: 'TEST_SETTING' }
      const expectedResult = {
        pk: 'SETTING#test-tenant',
        sk: 'TEST_SETTING',
        isDeleted: true,
        version: 2,
      }

      jest.spyOn(service, 'delete').mockResolvedValue(expectedResult as any)

      const result = await controller.deleteSetting(mockInvokeContext, key)

      expect(service.delete).toHaveBeenCalledWith(key, {
        invokeContext: mockInvokeContext,
      })
      expect(result).toEqual(expectedResult)
    })

    it('should handle invalid tenant code', async () => {
      const key: DetailDto = { pk: 'SETTING#other-tenant', sk: 'TEST_SETTING' }

      await expect(controller.deleteSetting(mockInvokeContext, key)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('should handle deletion errors', async () => {
      const key: DetailDto = { pk: 'SETTING#test-tenant', sk: 'TEST_SETTING' }
      const error = new Error('Deletion failed')

      jest.spyOn(service, 'delete').mockRejectedValue(error)

      await expect(controller.deleteSetting(mockInvokeContext, key)).rejects.toThrow(
        'Deletion failed',
      )
    })
  })

  describe('checkExistCode', () => {
    it('should check existing code successfully', async () => {
      const code = 'TEST_SETTING'
      const expectedResult = { exists: true }

      jest.spyOn(service, 'checkExistSettingCode').mockResolvedValue(expectedResult as any)

      const result = await controller.checkExistCode(mockInvokeContext, code)

      expect(service.checkExistSettingCode).toHaveBeenCalledWith('test-tenant', code)
      expect(result).toEqual(expectedResult)
    })

    it('should handle check errors', async () => {
      const code = 'TEST_SETTING'
      const error = new Error('Check failed')

      jest.spyOn(service, 'checkExistSettingCode').mockRejectedValue(error)

      await expect(controller.checkExistCode(mockInvokeContext, code)).rejects.toThrow(
        'Check failed',
      )
    })
  })
})
