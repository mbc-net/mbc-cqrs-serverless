import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { DetailDto, IInvoke } from '@mbc-cqrs-serverless/core'

import { MasterDataController } from './master-data.controller'
import { MasterDataService } from '../services/master-data.service'
import { MasterDataEntity } from '../entities/master-data/master-data.entity'
import {
  CustomMasterDataSearchDto,
  MasterDataCreateDto,
  MasterDataUpdateDto,
} from '../dto'
import { MasterDataCreateBulkDto } from '../dto/master-copy/master-data-create-bulk.dto'
import { CreateMasterDataDto } from '../dto/master-data/data-create.dto'
import { MasterDataSearchDto } from '../dto/master-data/data-search.dto'
import { UpdateDataSettingDto } from '../dto/master-data/data-update.dto'

describe('MasterDataController', () => {
  let controller: MasterDataController
  let service: MasterDataService

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
    const mockMasterDataService = {
      list: jest.fn(),
      getDetail: jest.fn(),
      get: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      checkExistCode: jest.fn(),
      listByRds: jest.fn(),
      createSetting: jest.fn(),
      createBulk: jest.fn(),
      upsertBulk: jest.fn(),
      updateSetting: jest.fn(),
      deleteSetting: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MasterDataController],
      providers: [
        {
          provide: MasterDataService,
          useValue: mockMasterDataService,
        },
      ],
    }).compile()

    controller = module.get<MasterDataController>(MasterDataController)
    service = module.get<MasterDataService>(MasterDataService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('listData', () => {
    it('should list data successfully', async () => {
      const searchDto: MasterDataSearchDto = { settingCode: 'TEST_SETTING' }
      const expectedResult = { items: [], total: 0 }

      jest.spyOn(service, 'list').mockResolvedValue(expectedResult)

      const result = await controller.listData(mockInvokeContext, searchDto)

      expect(service.list).toHaveBeenCalledWith(searchDto)
      expect(result).toEqual(expectedResult)
    })
  })

  describe('getDetailById', () => {
    it('should get detail by id successfully', async () => {
      const key: DetailDto = { pk: 'test-pk', sk: 'test-sk' }
      const expectedResult = {
        id: 'data-1',
        cpk: 'test-cpk',
        csk: 'test-csk',
        pk: 'test-pk',
        sk: 'test-sk',
        masterType: 'TEST_TYPE',
        masterTypeCode: 'TEST_CODE',
        masterCode: 'MASTER_001',
        tenantCode: 'test-tenant',
        seq: 1,
        code: 'DATA_001',
        name: 'Test Data',
        version: 1,
        isDeleted: false,
        createdBy: 'test-user',
        createdIp: '127.0.0.1',
        createdAt: new Date(),
        updatedBy: 'test-user',
        updatedIp: '127.0.0.1',
        updatedAt: new Date(),
      }

      jest.spyOn(service, 'getDetail').mockResolvedValue(expectedResult)

      const result = await controller.getDetailById(key)

      expect(service.getDetail).toHaveBeenCalledWith(key)
      expect(result).toEqual(expectedResult)
    })
  })

  describe('getDetail', () => {
    it('should get detail successfully', async () => {
      const key: DetailDto = { pk: 'test-pk', sk: 'test-sk' }
      const expectedResult = new MasterDataEntity({
        pk: 'test-pk',
        sk: 'test-sk',
        id: 'data-1',
        tenantCode: 'test-tenant',
        name: 'Test Data',
        code: 'DATA_001',
        type: 'TEST_TYPE',
        seq: 1,
        attributes: { key: 'value' },
        version: 1,
        isDeleted: false,
        createdBy: 'test-user',
        createdAt: new Date(),
        updatedBy: 'test-user',
        updatedAt: new Date(),
      })

      jest.spyOn(service, 'get').mockResolvedValue(expectedResult)

      const result = await controller.getDetail(mockInvokeContext, key)

      expect(service.get).toHaveBeenCalledWith(key)
      expect(result).toEqual(expectedResult)
    })
  })

  describe('createDataSetting', () => {
    it('should create data setting successfully', async () => {
      const createDto: CreateMasterDataDto = {
        tenantCode: 'test-tenant',
        settingCode: 'TEST_SETTING',
        name: 'New Data',
        code: 'DATA_002',
        seq: 1,
        attributes: { type: 'TEXT', value: 'test-value' },
      }
      const expectedResult = new MasterDataEntity({
        pk: 'test-tenant#master-data',
        sk: 'DATA_002',
        id: 'data-2',
        tenantCode: 'test-tenant',
        name: 'New Data',
        code: 'DATA_002',
        type: 'TEST_TYPE',
        seq: 1,
        attributes: { type: 'TEXT', value: 'test-value' },
        version: 1,
        isDeleted: false,
        createdBy: 'test-user',
        createdAt: new Date(),
        updatedBy: 'test-user',
        updatedAt: new Date(),
      })

      jest.spyOn(service, 'create').mockResolvedValue(expectedResult)

      const result = await controller.createDataSetting(
        mockInvokeContext,
        createDto,
      )

      expect(service.create).toHaveBeenCalledWith(createDto, {
        invokeContext: mockInvokeContext,
      })
      expect(result).toEqual(expectedResult)
    })
  })

  describe('updateDataSetting', () => {
    it('should update data setting successfully', async () => {
      const key: DetailDto = { pk: 'test-pk', sk: 'test-sk' }
      const updateDto: UpdateDataSettingDto = { name: 'Updated Data' }
      const expectedResult = new MasterDataEntity({
        pk: 'test-pk',
        sk: 'test-sk',
        id: 'data-1',
        tenantCode: 'test-tenant',
        name: 'Updated Data',
        code: 'DATA_001',
        type: 'TEST_TYPE',
        seq: 1,
        attributes: { key: 'value' },
        version: 2,
        isDeleted: false,
        createdBy: 'test-user',
        createdAt: new Date(),
        updatedBy: 'test-user',
        updatedAt: new Date(),
      })

      jest.spyOn(service, 'update').mockResolvedValue(expectedResult)

      const result = await controller.updateDataSetting(
        mockInvokeContext,
        key,
        updateDto,
      )

      expect(service.update).toHaveBeenCalledWith(key, updateDto, {
        invokeContext: mockInvokeContext,
      })
      expect(result).toEqual(expectedResult)
    })
  })

  describe('deleteDataSetting', () => {
    it('should delete data setting successfully', async () => {
      const key: DetailDto = { pk: 'test-pk', sk: 'test-sk' }
      const expectedResult = new MasterDataEntity({
        pk: 'test-pk',
        sk: 'test-sk',
        id: 'data-1',
        tenantCode: 'test-tenant',
        name: 'Test Data',
        code: 'DATA_001',
        type: 'TEST_TYPE',
        seq: 1,
        attributes: { key: 'value' },
        version: 1,
        isDeleted: true,
        createdBy: 'test-user',
        createdAt: new Date(),
        updatedBy: 'test-user',
        updatedAt: new Date(),
      })

      jest.spyOn(service, 'delete').mockResolvedValue(expectedResult)

      const result = await controller.deleteDataSetting(mockInvokeContext, key)

      expect(service.delete).toHaveBeenCalledWith(key, {
        invokeContext: mockInvokeContext,
      })
      expect(result).toEqual(expectedResult)
    })
  })

  describe('checkExistCode', () => {
    it('should check exist code successfully', async () => {
      const settingCode = 'TEST_SETTING'
      const code = 'TEST_CODE'
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
  })

  describe('list', () => {
    it('should list by RDS successfully', async () => {
      const searchDto: CustomMasterDataSearchDto = {
        settingCode: 'TEST_SETTING',
        code: 'TEST_CODE',
      }
      const expectedResult = { items: [], total: 0 }

      jest.spyOn(service, 'listByRds').mockResolvedValue(expectedResult)

      const result = await controller.list(searchDto, mockInvokeContext)

      expect(service.listByRds).toHaveBeenCalledWith(searchDto, {
        invokeContext: mockInvokeContext,
      })
      expect(result).toEqual(expectedResult)
    })
  })

  describe('create', () => {
    it('should create setting successfully', async () => {
      const createDto: MasterDataCreateDto = {
        settingCode: 'TEST_SETTING',
        name: 'New Setting',
        code: 'SETTING_001',
        seq: 1,
        attributes: { type: 'TEXT' },
      }
      const expectedResult = new MasterDataEntity({
        pk: 'test-tenant#master-setting',
        sk: 'SETTING_001',
        id: 'setting-1',
        tenantCode: 'test-tenant',
        name: 'New Setting',
        code: 'SETTING_001',
        type: 'SETTING_TYPE',
        seq: 1,
        attributes: { type: 'TEXT' },
        version: 1,
        isDeleted: false,
        createdBy: 'test-user',
        createdAt: new Date(),
        updatedBy: 'test-user',
        updatedAt: new Date(),
      })

      jest.spyOn(service, 'createSetting').mockResolvedValue(expectedResult)

      const result = await controller.create(createDto, mockInvokeContext)

      expect(service.createSetting).toHaveBeenCalledWith(
        createDto,
        mockInvokeContext,
      )
      expect(result).toEqual(expectedResult)
    })
  })

  describe('createBulk', () => {
    it('should call upsertBulk', async () => {
      const createDto = {
        items: [
          {
            settingCode: 'TEST_SETTING',
            name: 'Item 1',
            code: 'CODE1',
            seq: 1,
            attributes: { key: 'value1' },
          },
        ],
      }
      const expectedResult = [
        new MasterDataEntity({
          pk: 'MASTER#test-tenant',
          sk: 'TEST_SETTING#CODE1',
          id: 'data-1',
          tenantCode: 'test-tenant',
          name: 'Item 1',
          code: 'CODE1',
          type: 'MASTER',
          seq: 1,
          attributes: { key: 'value1' },
          version: 1,
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ]

      jest.spyOn(service, 'upsertBulk').mockResolvedValue(expectedResult)

      const result = await controller.createBulk(createDto, mockInvokeContext)

      expect(service.upsertBulk).toHaveBeenCalledWith(
        createDto,
        mockInvokeContext,
      )
      expect(result).toEqual(expectedResult)
    })
  })

  describe('update', () => {
    it('should update setting successfully with valid tenant', async () => {
      const key: DetailDto = { pk: 'MASTER#test-tenant', sk: 'test-sk' }
      const updateDto: MasterDataUpdateDto = { name: 'Updated Setting' }
      const expectedResult = new MasterDataEntity({
        pk: 'MASTER#test-tenant',
        sk: 'test-sk',
        id: 'setting-1',
        tenantCode: 'test-tenant',
        name: 'Updated Setting',
        code: 'SETTING_001',
        type: 'SETTING_TYPE',
        seq: 1,
        attributes: { updated: true },
        version: 2,
        isDeleted: false,
        createdBy: 'test-user',
        createdAt: new Date(),
        updatedBy: 'test-user',
        updatedAt: new Date(),
      })

      jest.spyOn(service, 'updateSetting').mockResolvedValue(expectedResult)

      const result = await controller.update(key, updateDto, mockInvokeContext)

      expect(service.updateSetting).toHaveBeenCalledWith(
        key,
        updateDto,
        mockInvokeContext,
      )
      expect(result).toEqual(expectedResult)
    })

    it('should throw BadRequestException for invalid tenant code', async () => {
      const key: DetailDto = { pk: 'other-tenant#setting-1', sk: 'test-sk' }
      const updateDto: MasterDataUpdateDto = { name: 'Updated Setting' }

      await expect(
        controller.update(key, updateDto, mockInvokeContext),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('delete', () => {
    it('should delete setting successfully with valid tenant', async () => {
      const key: DetailDto = { pk: 'MASTER#test-tenant', sk: 'test-sk' }
      const expectedResult = new MasterDataEntity({
        pk: 'MASTER#test-tenant',
        sk: 'test-sk',
        id: 'setting-1',
        tenantCode: 'test-tenant',
        name: 'Test Setting',
        code: 'SETTING_001',
        type: 'SETTING_TYPE',
        seq: 1,
        attributes: { deleted: true },
        version: 1,
        isDeleted: true,
        createdBy: 'test-user',
        createdAt: new Date(),
        updatedBy: 'test-user',
        updatedAt: new Date(),
      })

      jest.spyOn(service, 'deleteSetting').mockResolvedValue(expectedResult)

      const result = await controller.delete(key, mockInvokeContext)

      expect(service.deleteSetting).toHaveBeenCalledWith(key, mockInvokeContext)
      expect(result).toEqual(expectedResult)
    })

    it('should throw BadRequestException for invalid tenant code', async () => {
      const key: DetailDto = { pk: 'other-tenant#setting-1', sk: 'test-sk' }

      await expect(controller.delete(key, mockInvokeContext)).rejects.toThrow(
        BadRequestException,
      )
    })
  })
})
