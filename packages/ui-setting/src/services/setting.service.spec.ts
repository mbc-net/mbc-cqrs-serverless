import { Test, TestingModule } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { SettingService } from './setting.service'
import {
  CommandService,
  DataService,
  DetailDto,
  IInvoke,
  DataModel,
  CommandModel,
  DataListEntity,
} from '@mbc-cqrs-serverless/core'
import { CreateSettingDto } from '../dto/setting-create.dto'
import { UpdateSettingDto } from '../dto/setting-update.dto'
import { SettingDataEntity } from '../entities/setting-data.entity'
import { SettingDataListEntity } from '../entities/setting-data-list.entity'

describe('SettingService', () => {
  let service: SettingService
  let commandService: jest.Mocked<CommandService>
  let dataService: jest.Mocked<DataService>

  const mockInvokeContext: IInvoke = {
    context: { awsRequestId: 'test-request-id' },
    event: { requestContext: { http: { sourceIp: '127.0.0.1' } } },
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingService,
        {
          provide: CommandService,
          useValue: createMock<CommandService>(),
        },
        {
          provide: DataService,
          useValue: createMock<DataService>(),
        },
      ],
    }).compile()

    service = module.get<SettingService>(SettingService)
    commandService = module.get(CommandService)
    dataService = module.get(DataService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('list', () => {
    it('should list settings by tenant code', async () => {
      const tenantCode = 'TEST_TENANT'
      const mockResponse = {
        items: [
          {
            pk: 'MASTER#TEST_TENANT',
            sk: 'MASTER_SETTING#CODE1',
            id: 'test-id-1',
            code: 'CODE1',
            name: 'Setting 1',
            version: 1,
            type: 'MASTER',
            tenantCode: 'TEST_TENANT',
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      }

      dataService.listItemsByPk.mockResolvedValue(mockResponse as any)

      const result = await service.list(tenantCode)

      expect(dataService.listItemsByPk).toHaveBeenCalledWith(
        'MASTER#TEST_TENANT',
        expect.objectContaining({
          sk: expect.objectContaining({
            skExpression: 'begins_with(sk, :settingPrefix)',
            skAttributeValues: {
              ':settingPrefix': 'MASTER_SETTING#',
            },
          }),
          limit: 100,
        })
      )
      expect(result).toBeInstanceOf(SettingDataListEntity)
    })
  })

  describe('get', () => {
    it('should get setting by key', async () => {
      const key: DetailDto = { pk: 'MASTER#TEST_TENANT', sk: 'MASTER_SETTING#CODE1' }
      const mockData: DataModel = {
        pk: key.pk,
        sk: key.sk,
        id: 'test-id',
        code: 'CODE1',
        name: 'Test Setting',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(mockData)

      const result = await service.get(key)

      expect(dataService.getItem).toHaveBeenCalledWith(key)
      expect(result).toBeInstanceOf(SettingDataEntity)
    })
  })

  describe('create', () => {
    it('should create new setting when not exists', async () => {
      const tenantCode = 'TEST_TENANT'
      const createDto: CreateSettingDto = {
        code: 'NEW_CODE',
        name: 'New Setting',
        attributes: {
          fields: [
            { physicalName: 'field1', name: 'Field 1', dataType: 'string', isRequired: true, isShowedOnList: true },
            { physicalName: 'field2', name: 'Field 2', dataType: 'number', isRequired: false, isShowedOnList: false },
          ],
          description: 'Test setting description',
        },
      }

      dataService.getItem.mockResolvedValue(null as any)
      const mockCommandResult: CommandModel = {
        id: 'MASTER#TEST_TENANT#MASTER_SETTING#NEW_CODE',
        pk: 'MASTER#TEST_TENANT',
        sk: 'MASTER_SETTING#NEW_CODE',
        version: 0,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        code: createDto.code,
        name: createDto.name,
        isDeleted: false,
        attributes: createDto.attributes,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      commandService.publishAsync.mockResolvedValue(mockCommandResult)

      const result = await service.create(tenantCode, createDto, { invokeContext: mockInvokeContext })

      expect(dataService.getItem).toHaveBeenCalledWith({
        pk: 'MASTER#TEST_TENANT',
        sk: 'MASTER_SETTING#NEW_CODE',
      })
      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'MASTER#TEST_TENANT#MASTER_SETTING#NEW_CODE',
          pk: 'MASTER#TEST_TENANT',
          sk: 'MASTER_SETTING#NEW_CODE',
          version: 0,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          code: createDto.code,
          name: createDto.name,
          isDeleted: false,
          attributes: createDto.attributes,
        }),
        expect.objectContaining({
          source: expect.stringContaining('createSetting'),
          invokeContext: mockInvokeContext,
        })
      )
      expect(result).toBeInstanceOf(SettingDataEntity)
    })

    it('should throw BadRequestException when setting already exists', async () => {
      const tenantCode = 'TEST_TENANT'
      const createDto: CreateSettingDto = {
        code: 'EXISTING_CODE',
        name: 'Existing Setting',
        attributes: {
          fields: [],
          description: 'Test description',
        },
      }

      const existingData: DataModel = {
        pk: 'MASTER#TEST_TENANT',
        sk: 'MASTER_SETTING#EXISTING_CODE',
        id: 'existing-id',
        code: 'EXISTING_CODE',
        name: 'Existing Setting',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(existingData)

      await expect(
        service.create(tenantCode, createDto, { invokeContext: mockInvokeContext })
      ).rejects.toThrow(BadRequestException)
      await expect(
        service.create(tenantCode, createDto, { invokeContext: mockInvokeContext })
      ).rejects.toThrow('Setting code already exists')
    })

    it('should create when existing setting is deleted', async () => {
      const tenantCode = 'TEST_TENANT'
      const createDto: CreateSettingDto = {
        code: 'DELETED_CODE',
        name: 'Recreated Setting',
        attributes: {
          fields: [],
          description: 'Test description',
        },
      }

      const deletedData: DataModel = {
        pk: 'MASTER#TEST_TENANT',
        sk: 'MASTER_SETTING#DELETED_CODE',
        id: 'deleted-id',
        code: 'DELETED_CODE',
        name: 'Deleted Setting',
        version: 2,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(deletedData)
      const mockCommandResult: CommandModel = {
        id: 'MASTER#TEST_TENANT#MASTER_SETTING#DELETED_CODE',
        pk: 'MASTER#TEST_TENANT',
        sk: 'MASTER_SETTING#DELETED_CODE',
        version: 2,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        code: createDto.code,
        name: createDto.name,
        isDeleted: false,
        attributes: createDto.attributes,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      commandService.publishAsync.mockResolvedValue(mockCommandResult)

      const result = await service.create(tenantCode, createDto, { invokeContext: mockInvokeContext })

      expect(result).toBeInstanceOf(SettingDataEntity)
      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 2,
        }),
        expect.any(Object)
      )
    })

    it('should throw BadRequestException for duplicate physical names in fields', async () => {
      const tenantCode = 'TEST_TENANT'
      const createDto: CreateSettingDto = {
        code: 'INVALID_CODE',
        name: 'Invalid Setting',
        attributes: {
          fields: [
            { physicalName: 'field1', name: 'Field 1', dataType: 'string', isRequired: true, isShowedOnList: true },
            { physicalName: 'field1', name: 'Field 1 Duplicate', dataType: 'number', isRequired: false, isShowedOnList: false },
          ],
          description: 'Test description',
        },
      }

      await expect(
        service.create(tenantCode, createDto, { invokeContext: mockInvokeContext })
      ).rejects.toThrow(BadRequestException)
      await expect(
        service.create(tenantCode, createDto, { invokeContext: mockInvokeContext })
      ).rejects.toThrow('Physical name of fields must not be duplicated')
    })
  })

  describe('update', () => {
    it('should update existing setting', async () => {
      const key: DetailDto = { pk: 'MASTER#TEST_TENANT', sk: 'MASTER_SETTING#CODE1' }
      const updateDto: UpdateSettingDto = {
        name: 'Updated Setting',
        attributes: {
          fields: [
            { physicalName: 'updated_field', name: 'Updated Field', dataType: 'string', isRequired: true, isShowedOnList: true },
          ],
          description: 'Updated description',
        },
      }

      const existingData = {
        id: 'test-id',
        pk: key.pk,
        sk: key.sk,
        code: 'CODE1',
        name: 'Original Setting',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: false,
        attributes: {
          fields: [
            { physicalName: 'original_field', name: 'Original Field', dataType: 'string', isRequired: true, isShowedOnList: true },
          ],
          description: 'Original description',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(existingData)
      const mockUpdateResult: CommandModel = {
        ...existingData,
        name: updateDto.name!,
        attributes: updateDto.attributes!,
        updatedAt: new Date(),
      }
      commandService.publishAsync.mockResolvedValue(mockUpdateResult)

      const result = await service.update(key, updateDto, { invokeContext: mockInvokeContext })

      expect(dataService.getItem).toHaveBeenCalledWith(key)
      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: updateDto.name,
          attributes: updateDto.attributes,
        }),
        expect.objectContaining({
          source: expect.stringContaining('updateSetting'),
          invokeContext: mockInvokeContext,
        })
      )
      expect(result).toBeInstanceOf(SettingDataEntity)
    })

    it('should throw NotFoundException when setting does not exist', async () => {
      const key: DetailDto = { pk: 'SETTING#TEST_TENANT', sk: 'SETTING#NONEXISTENT' }
      const updateDto: UpdateSettingDto = {
        name: 'Updated Setting',
      }

      dataService.getItem.mockResolvedValue(null as any)

      await expect(
        service.update(key, updateDto, { invokeContext: mockInvokeContext })
      ).rejects.toThrow(NotFoundException)
    })

    it('should preserve existing values when update fields are not provided', async () => {
      const key: DetailDto = { pk: 'MASTER#TEST_TENANT', sk: 'MASTER_SETTING#CODE1' }
      const updateDto: UpdateSettingDto = {
        name: 'Updated Name Only',
      }

      const existingData = {
        id: 'test-id',
        pk: key.pk,
        sk: key.sk,
        code: 'CODE1',
        name: 'Original Setting',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: false,
        attributes: {
          fields: [
            { physicalName: 'existing_field', name: 'Existing Field', dataType: 'string', isRequired: true, isShowedOnList: true },
          ],
          description: 'Existing description',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(existingData)
      const mockUpdateResult: CommandModel = {
        ...existingData,
        name: updateDto.name!,
        updatedAt: new Date(),
      }
      commandService.publishAsync.mockResolvedValue(mockUpdateResult)

      await service.update(key, updateDto, { invokeContext: mockInvokeContext })

      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: updateDto.name,
          attributes: existingData.attributes,
        }),
        expect.any(Object)
      )
    })

    it('should throw BadRequestException for duplicate physical names in updated fields', async () => {
      const key: DetailDto = { pk: 'MASTER#TEST_TENANT', sk: 'MASTER_SETTING#CODE1' }
      const updateDto: UpdateSettingDto = {
        attributes: {
          fields: [
            { physicalName: 'field1', name: 'Field 1', dataType: 'string', isRequired: true, isShowedOnList: true },
            { physicalName: 'field1', name: 'Field 1 Duplicate', dataType: 'number', isRequired: false, isShowedOnList: false },
          ],
          description: 'Updated description',
        },
      }

      const existingData = {
        id: 'test-id',
        pk: key.pk,
        sk: key.sk,
        code: 'CODE1',
        name: 'Original Setting',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: false,
        attributes: {
          fields: [],
          description: 'Original description',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(existingData)

      await expect(
        service.update(key, updateDto, { invokeContext: mockInvokeContext })
      ).rejects.toThrow(BadRequestException)
      await expect(
        service.update(key, updateDto, { invokeContext: mockInvokeContext })
      ).rejects.toThrow('Physical name of fields must not be duplicated')
    })
  })

  describe('delete', () => {
    it('should soft delete existing setting', async () => {
      const key: DetailDto = { pk: 'MASTER#TEST_TENANT', sk: 'MASTER_SETTING#CODE1' }

      const existingData = {
        id: 'test-id',
        pk: key.pk,
        sk: key.sk,
        code: 'CODE1',
        name: 'Test Setting',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: false,
        attributes: {
          fields: [],
          description: 'Test description',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(existingData)
      const mockDeleteResult: CommandModel = {
        ...existingData,
        isDeleted: true,
        updatedAt: new Date(),
      }
      commandService.publishAsync.mockResolvedValue(mockDeleteResult)

      const result = await service.delete(key, { invokeContext: mockInvokeContext })

      expect(dataService.getItem).toHaveBeenCalledWith(key)
      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          ...existingData,
          isDeleted: true,
        }),
        expect.objectContaining({
          source: expect.stringContaining('deleteSetting'),
          invokeContext: mockInvokeContext,
        })
      )
      expect(result).toBeInstanceOf(SettingDataEntity)
    })

    it('should throw NotFoundException when setting does not exist', async () => {
      const key: DetailDto = { pk: 'SETTING#TEST_TENANT', sk: 'SETTING#NONEXISTENT' }

      dataService.getItem.mockResolvedValue(null as any)

      await expect(
        service.delete(key, { invokeContext: mockInvokeContext })
      ).rejects.toThrow(NotFoundException)
    })

    it('should throw BadRequestException when setting is already deleted', async () => {
      const key: DetailDto = { pk: 'MASTER#TEST_TENANT', sk: 'MASTER_SETTING#CODE1' }

      const deletedData = {
        id: 'test-id',
        pk: key.pk,
        sk: key.sk,
        code: 'CODE1',
        name: 'Test Setting',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: true,
        attributes: {
          fields: [],
          description: 'Test description',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(deletedData)

      await expect(
        service.delete(key, { invokeContext: mockInvokeContext })
      ).rejects.toThrow(BadRequestException)
      await expect(
        service.delete(key, { invokeContext: mockInvokeContext })
      ).rejects.toThrow('This setting is already deleted')
    })
  })

  describe('checkExistSettingCode', () => {
    it('should return true when setting code exists and is not deleted', async () => {
      const tenantCode = 'TEST_TENANT'
      const code = 'EXISTING_CODE'

      const existingData = {
        id: 'test-id',
        pk: 'MASTER#TEST_TENANT',
        sk: 'MASTER_SETTING#EXISTING_CODE',
        code: 'EXISTING_CODE',
        name: 'Existing Setting',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: false,
        attributes: {
          fields: [],
          description: 'Test description',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        key: { pk: 'SETTING#TEST_TENANT', sk: 'SETTING#EXISTING_CODE' },
      }

      dataService.getItem.mockResolvedValue(existingData)

      const result = await service.checkExistSettingCode(tenantCode, code)

      expect(dataService.getItem).toHaveBeenCalledWith({
        pk: 'MASTER#TEST_TENANT',
        sk: 'MASTER_SETTING#EXISTING_CODE',
      })
      expect(result).toBe(true)
    })

    it('should return false when setting code does not exist', async () => {
      const tenantCode = 'TEST_TENANT'
      const code = 'NONEXISTENT_CODE'

      dataService.getItem.mockResolvedValue(null as any)

      const result = await service.checkExistSettingCode(tenantCode, code)

      expect(result).toBe(false)
    })

    it('should return false when setting code exists but is deleted', async () => {
      const tenantCode = 'TEST_TENANT'
      const code = 'DELETED_CODE'

      const deletedData = {
        id: 'test-id',
        pk: 'MASTER#TEST_TENANT',
        sk: 'MASTER_SETTING#DELETED_CODE',
        code: 'DELETED_CODE',
        name: 'Deleted Setting',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: true,
        attributes: {
          fields: [],
          description: 'Test description',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        key: { pk: 'SETTING#TEST_TENANT', sk: 'SETTING#DELETED_CODE' },
      }

      dataService.getItem.mockResolvedValue(deletedData)

      const result = await service.checkExistSettingCode(tenantCode, code)

      expect(result).toBe(false)
    })
  })

  describe('isValidFields', () => {
    it('should validate unique physical names correctly', () => {
      const validFields = [
        { physicalName: 'field1', logicalName: 'Field 1', dataType: 'string' },
        { physicalName: 'field2', logicalName: 'Field 2', dataType: 'number' },
      ]

      const invalidFields = [
        { physicalName: 'field1', logicalName: 'Field 1', dataType: 'string' },
        { physicalName: 'field1', logicalName: 'Field 1 Duplicate', dataType: 'number' },
      ]

      expect((service as any).isValidFields(validFields)).toBe(true)
      expect((service as any).isValidFields(invalidFields)).toBe(false)
      expect((service as any).isValidFields([])).toBe(true)
    })
  })
})
