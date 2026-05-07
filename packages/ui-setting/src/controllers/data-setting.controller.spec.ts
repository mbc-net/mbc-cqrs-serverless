import { createMock } from '@golevelup/ts-jest'
import { BadRequestException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { DetailDto, IInvoke, getUserContext } from '@mbc-cqrs-serverless/core'

import { DataSettingController } from './data-setting.controller'
import { DataSettingService } from '../services/data-setting.service'
import { DataSettingSearchDto } from '../dto/data-setting-search.dto'
import { DataSettingDataListEntity } from '../entities/data-setting-data-list.entity'

// Mock getUserContext
jest.mock('@mbc-cqrs-serverless/core', () => {
  const original = jest.requireActual('@mbc-cqrs-serverless/core')
  return {
    ...original,
    getUserContext: jest.fn(),
  }
})

const mockGetUserContext = getUserContext as jest.MockedFunction<
  typeof getUserContext
>

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
    // Default mock for getUserContext
    mockGetUserContext.mockReturnValue({
      tenantCode: 'test-tenant',
      userId: 'test-user',
    } as any)

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DataSettingController],
      providers: [DataSettingService],
    })
      .useMocker(createMock)
      .compile()

    controller = module.get<DataSettingController>(DataSettingController)
    service = module.get<DataSettingService>(DataSettingService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('listData', () => {
    it('should list data settings successfully', async () => {
      const searchDto: DataSettingSearchDto = {}
      const expectedResult = {
        items: [
          {
            pk: 'MASTER#test-tenant',
            sk: 'SETTING1#DATA1',
            code: 'DATA1',
            name: 'Test Data 1',
          },
        ],
      } as DataSettingDataListEntity

      jest.spyOn(service, 'list').mockResolvedValue(expectedResult)

      const result = await controller.listData(mockInvokeContext, searchDto)

      expect(service.list).toHaveBeenCalledWith('test-tenant', searchDto)
      expect(result).toEqual(expectedResult)
    })

    it('should filter by setting code', async () => {
      const searchDto: DataSettingSearchDto = { settingCode: 'SETTING1' }
      const expectedResult = {
        items: [
          {
            pk: 'MASTER#test-tenant',
            sk: 'SETTING1#DATA1',
            code: 'DATA1',
          },
        ],
      } as DataSettingDataListEntity

      jest.spyOn(service, 'list').mockResolvedValue(expectedResult)

      const result = await controller.listData(mockInvokeContext, searchDto)

      expect(service.list).toHaveBeenCalledWith('test-tenant', searchDto)
      expect(result).toEqual(expectedResult)
    })

    it('should handle service errors', async () => {
      const searchDto: DataSettingSearchDto = {}
      const error = new Error('List failed')

      jest.spyOn(service, 'list').mockRejectedValue(error)

      await expect(
        controller.listData(mockInvokeContext, searchDto),
      ).rejects.toThrow('List failed')
    })
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

    it('should throw BadRequestException for mismatched tenant', async () => {
      mockGetUserContext.mockReturnValue({
        tenantCode: 'other-tenant',
        userId: 'test-user',
      } as any)

      const dto: DetailDto = { pk: 'MASTER#test-tenant', sk: 'test-sk' }

      await expect(
        controller.getDetail(mockInvokeContext, dto),
      ).rejects.toThrow(BadRequestException)
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

    it('should throw BadRequestException for mismatched tenant', async () => {
      mockGetUserContext.mockReturnValue({
        tenantCode: 'other-tenant',
        userId: 'test-user',
      } as any)

      const key: DetailDto = { pk: 'MASTER#test-tenant', sk: 'test-sk' }
      const updateDto = { name: 'Updated Data Setting' }

      await expect(
        controller.updateDataSetting(mockInvokeContext, key, updateDto as any),
      ).rejects.toThrow(BadRequestException)
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

    it('should throw BadRequestException for mismatched tenant', async () => {
      mockGetUserContext.mockReturnValue({
        tenantCode: 'other-tenant',
        userId: 'test-user',
      } as any)

      const key: DetailDto = { pk: 'MASTER#test-tenant', sk: 'test-sk' }

      await expect(
        controller.deleteDataSetting(mockInvokeContext, key),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('checkExistCode', () => {
    it('should return true when code exists', async () => {
      const settingCode = 'SETTING1'
      const code = 'DATA1'

      jest.spyOn(service, 'checkExistCode').mockResolvedValue(true)

      const result = await controller.checkExistCode(
        mockInvokeContext,
        settingCode,
        code,
      )

      expect(service.checkExistCode).toHaveBeenCalledWith(
        'test-tenant',
        settingCode,
        code,
      )
      expect(result).toBe(true)
    })

    it('should return false when code does not exist', async () => {
      const settingCode = 'SETTING1'
      const code = 'NONEXISTENT'

      jest.spyOn(service, 'checkExistCode').mockResolvedValue(false)

      const result = await controller.checkExistCode(
        mockInvokeContext,
        settingCode,
        code,
      )

      expect(service.checkExistCode).toHaveBeenCalledWith(
        'test-tenant',
        settingCode,
        code,
      )
      expect(result).toBe(false)
    })

    it('should use tenant from user context', async () => {
      mockGetUserContext.mockReturnValue({
        tenantCode: 'custom-tenant',
        userId: 'test-user',
      } as any)

      const settingCode = 'SETTING1'
      const code = 'DATA1'

      jest.spyOn(service, 'checkExistCode').mockResolvedValue(true)

      await controller.checkExistCode(mockInvokeContext, settingCode, code)

      expect(service.checkExistCode).toHaveBeenCalledWith(
        'custom-tenant',
        settingCode,
        code,
      )
    })

    it('should handle service errors', async () => {
      const settingCode = 'SETTING1'
      const code = 'DATA1'
      const error = new Error('Check failed')

      jest.spyOn(service, 'checkExistCode').mockRejectedValue(error)

      await expect(
        controller.checkExistCode(mockInvokeContext, settingCode, code),
      ).rejects.toThrow('Check failed')
    })
  })
})
