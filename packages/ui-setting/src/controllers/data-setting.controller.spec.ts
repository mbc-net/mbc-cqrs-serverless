import { createMock } from '@golevelup/ts-jest'
import { Test, TestingModule } from '@nestjs/testing'
import { DetailDto, IInvoke } from '@mbc-cqrs-serverless/core'

import { DataSettingController } from './data-setting.controller'
import { DataSettingService } from '../services/data-setting.service'

describe('DataSettingController', () => {
  let controller: DataSettingController
  let service: DataSettingService

  const mockInvokeContext = {
    event: {
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              'custom:tenant': 'test-tenant',
              'cognito:username': 'test-user',
              name: 'Test User',
            },
          },
        },
      },
    },
  } as IInvoke

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DataSettingController],
      providers: [DataSettingService],
    })
      .useMocker(createMock)
      .compile()

    controller = module.get<DataSettingController>(DataSettingController)
    service = module.get<DataSettingService>(DataSettingService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('getDetail', () => {
    it('should get detail successfully', async () => {
      const dto: DetailDto = { pk: 'MASTER#test-tenant', sk: 'test-sk' }
      const expectedResult = {
        pk: 'MASTER#test-tenant',
        sk: 'test-sk',
        settingCode: 'TEST_DATA_SETTING',
        name: 'Test Data Setting',
        type: 'TEXT',
        version: 1,
      }

      jest.spyOn(service, 'get').mockResolvedValue(expectedResult as any)

      const result = await controller.getDetail(mockInvokeContext, dto)

      expect(service.get).toHaveBeenCalledWith(dto)
      expect(result).toEqual(expectedResult)
    })

    it('should handle service errors', async () => {
      const dto: DetailDto = { pk: 'MASTER#test-tenant', sk: 'test-sk' }
      const error = new Error('Data setting not found')

      jest.spyOn(service, 'get').mockRejectedValue(error)

      await expect(controller.getDetail(mockInvokeContext, dto)).rejects.toThrow('Data setting not found')
    })
  })

  describe('createDataSetting', () => {
    it('should create data setting successfully', async () => {
      const createDto = { 
        settingCode: 'NEW_DATA_SETTING',
        name: 'New Data Setting', 
        type: 'TEXT' 
      }
      const expectedResult = {
        pk: 'test-tenant#data-setting',
        sk: 'NEW_DATA_SETTING',
        settingCode: 'NEW_DATA_SETTING',
        name: 'New Data Setting',
        type: 'TEXT',
        version: 1,
      }

      jest.spyOn(service, 'create').mockResolvedValue(expectedResult as any)

      const result = await controller.createDataSetting(mockInvokeContext, createDto as any)

      expect(service.create).toHaveBeenCalledWith(
        'test-tenant',
        createDto,
        { invokeContext: mockInvokeContext },
      )
      expect(result).toEqual(expectedResult)
    })

    it('should handle creation errors', async () => {
      const createDto = { 
        settingCode: 'NEW_DATA_SETTING',
        name: 'New Data Setting', 
        type: 'TEXT' 
      }
      const error = new Error('Creation failed')

      jest.spyOn(service, 'create').mockRejectedValue(error)

      await expect(
        controller.createDataSetting(mockInvokeContext, createDto as any),
      ).rejects.toThrow('Creation failed')
    })
  })

  describe('updateDataSetting', () => {
    it('should update data setting successfully', async () => {
      const key: DetailDto = { pk: 'MASTER#test-tenant', sk: 'test-sk' }
      const updateDto = { name: 'Updated Data Setting' }
      const expectedResult = {
        pk: 'MASTER#test-tenant',
        sk: 'test-sk',
        name: 'Updated Data Setting',
        version: 2,
      }

      jest.spyOn(service, 'update').mockResolvedValue(expectedResult as any)

      const result = await controller.updateDataSetting(
        mockInvokeContext,
        key,
        updateDto as any,
      )

      expect(service.update).toHaveBeenCalledWith(key, updateDto, {
        invokeContext: mockInvokeContext,
      })
      expect(result).toEqual(expectedResult)
    })

    it('should handle update errors', async () => {
      const key: DetailDto = { pk: 'MASTER#test-tenant', sk: 'test-sk' }
      const updateDto = { name: 'Updated Data Setting' }
      const error = new Error('Update failed')

      jest.spyOn(service, 'update').mockRejectedValue(error)

      await expect(
        controller.updateDataSetting(mockInvokeContext, key, updateDto as any),
      ).rejects.toThrow('Update failed')
    })
  })

  describe('deleteDataSetting', () => {
    it('should delete data setting successfully', async () => {
      const key: DetailDto = { pk: 'MASTER#test-tenant', sk: 'test-sk' }
      const expectedResult = {
        pk: 'MASTER#test-tenant',
        sk: 'test-sk',
        isDeleted: true,
        version: 2,
      }

      jest.spyOn(service, 'delete').mockResolvedValue(expectedResult as any)

      const result = await controller.deleteDataSetting(mockInvokeContext, key)

      expect(service.delete).toHaveBeenCalledWith(key, {
        invokeContext: mockInvokeContext,
      })
      expect(result).toEqual(expectedResult)
    })

    it('should handle deletion errors', async () => {
      const key: DetailDto = { pk: 'MASTER#test-tenant', sk: 'test-sk' }
      const error = new Error('Deletion failed')

      jest.spyOn(service, 'delete').mockRejectedValue(error)

      await expect(
        controller.deleteDataSetting(mockInvokeContext, key),
      ).rejects.toThrow('Deletion failed')
    })
  })
})
