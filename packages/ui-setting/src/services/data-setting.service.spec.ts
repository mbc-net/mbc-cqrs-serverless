import { Test, TestingModule } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { CommandService, DataService, IInvoke } from '@mbc-cqrs-serverless/core'
import { DataSettingService } from './data-setting.service'
import { CreateDataSettingDto } from '../dto/data-setting-create.dto'
import { UpdateDataSettingDto } from '../dto/data-setting-update.dto'
import { DataSettingSearchDto } from '../dto/data-setting-search.dto'
import { DataSettingDataEntity } from '../entities/data-setting-data.entity'
import { DataSettingDataListEntity } from '../entities/data-setting-data-list.entity'
import { SettingDataEntity } from '../entities/setting-data.entity'

describe('DataSettingService', () => {
  let service: DataSettingService
  let commandService: jest.Mocked<CommandService>
  let dataService: jest.Mocked<DataService>

  const mockInvokeContext: IInvoke = {
    context: { awsRequestId: 'test-request-id' },
    event: { requestContext: { http: { sourceIp: '127.0.0.1' } } },
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataSettingService,
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

    service = module.get<DataSettingService>(DataSettingService)
    commandService = module.get(CommandService)
    dataService = module.get(DataService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('list', () => {
    it('should list data settings by tenant code', async () => {
      const tenantCode = 'TEST_TENANT'
      const searchDto: DataSettingSearchDto = {}
      const mockResponse = {
        items: [
          {
            pk: 'MASTER#TEST_TENANT',
            sk: 'SETTING1#DATA1',
            id: 'test-id-1',
            code: 'DATA1',
            settingCode: 'SETTING1',
            name: 'Data Setting 1',
            version: 1,
            type: 'MASTER',
            tenantCode: 'TEST_TENANT',
            isDeleted: false,
            attributes: { value: 'test-value-1' },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      }

      dataService.listItemsByPk.mockResolvedValue(mockResponse as any)

      const result = await service.list(tenantCode, searchDto)

      expect(dataService.listItemsByPk).toHaveBeenCalledWith(
        'MASTER#TEST_TENANT',
        expect.objectContaining({
          sk: undefined,
          limit: 100,
        })
      )
      expect(result).toBeInstanceOf(DataSettingDataListEntity)
    })

    it('should filter by setting code when provided', async () => {
      const tenantCode = 'TEST_TENANT'
      const searchDto: DataSettingSearchDto = { settingCode: 'SETTING1' }
      const mockResponse = {
        items: [
          {
            pk: 'MASTER#TEST_TENANT',
            sk: 'SETTING1#DATA1',
            id: 'test-id-1',
            code: 'DATA1',
            settingCode: 'SETTING1',
            name: 'Data Setting 1',
            version: 1,
            type: 'MASTER',
            tenantCode: 'TEST_TENANT',
            isDeleted: false,
            attributes: { value: 'test-value-1' },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      }

      dataService.listItemsByPk.mockResolvedValue(mockResponse as any)

      const result = await service.list(tenantCode, searchDto)

      expect(dataService.listItemsByPk).toHaveBeenCalledWith(
        'MASTER#TEST_TENANT',
        expect.objectContaining({
          sk: {
            skExpression: 'begins_with(sk, :settingCode)',
            skAttributeValues: {
              ':settingCode': 'SETTING1#',
            },
          },
          limit: 100,
        })
      )
      expect(result).toBeInstanceOf(DataSettingDataListEntity)
    })

    it('should filter out setting items from results', async () => {
      const tenantCode = 'TEST_TENANT'
      const searchDto: DataSettingSearchDto = {}
      const mockResponse = {
        items: [
          {
            pk: 'MASTER#TEST_TENANT',
            sk: 'SETTING1#DATA1',
            id: 'test-id-1',
            code: 'DATA1',
            settingCode: 'SETTING1',
            name: 'Data Setting 1',
            version: 1,
            type: 'MASTER',
            tenantCode: 'TEST_TENANT',
            isDeleted: false,
            attributes: { value: 'test-value-1' },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            pk: 'MASTER#TEST_TENANT',
            sk: 'MASTER_SETTING#SETTING1',
            id: 'setting-id',
            code: 'SETTING1',
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

      const result = await service.list(tenantCode, searchDto)

      expect(result.items).toHaveLength(1)
      expect(result.items[0].sk).toBe('SETTING1#DATA1')
    })
  })

  describe('get', () => {
    it('should get data setting by key', async () => {
      const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING1#DATA1' }
      const mockData = {
        pk: 'MASTER#TEST_TENANT',
        sk: 'SETTING1#DATA1',
        id: 'test-id',
        code: 'DATA1',
        settingCode: 'SETTING1',
        name: 'Data Setting 1',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: false,
        attributes: { value: 'test-value' },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(mockData as any)

      const result = await service.get(key)

      expect(dataService.getItem).toHaveBeenCalledWith(key)
      expect(result).toBeInstanceOf(DataSettingDataEntity)
    })
  })

  describe('create', () => {
    it('should create new data setting when not exists', async () => {
      const tenantCode = 'TEST_TENANT'
      const createDto: CreateDataSettingDto = {
        settingCode: 'SETTING1',
        code: 'NEW_DATA',
        name: 'New Data Setting',
        attributes: { value: 'new-value' },
      }

      const mockSetting: SettingDataEntity = {
        pk: 'MASTER#TEST_TENANT',
        sk: 'MASTER_SETTING#SETTING1',
        id: 'setting-id',
        code: 'SETTING1',
        name: 'Setting 1',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: false,
        attributes: {
          fields: [
            { name: 'Field 1', physicalName: 'field1', dataType: 'string', isRequired: true, isShowedOnList: true },
          ],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any

      const mockCommandResult = {
        id: 'MASTER#TEST_TENANT#SETTING1#NEW_DATA',
        pk: 'MASTER#TEST_TENANT',
        sk: 'SETTING1#NEW_DATA',
        version: 0,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        code: createDto.code,
        settingCode: createDto.settingCode,
        name: createDto.name,
        isDeleted: false,
        attributes: createDto.attributes,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockImplementation((key) => {
        if (key.sk === 'SETTING1#NEW_DATA') {
          return Promise.resolve(null as any)
        }
        if (key.sk === 'MASTER_SETTING#SETTING1') {
          return Promise.resolve(mockSetting as any)
        }
        return Promise.resolve(null as any)
      })
      commandService.publishAsync.mockResolvedValue(mockCommandResult as any)

      const result = await service.create(tenantCode, createDto, { invokeContext: mockInvokeContext })

      expect(dataService.getItem).toHaveBeenCalledWith({
        pk: 'MASTER#TEST_TENANT',
        sk: 'SETTING1#NEW_DATA',
      })
      expect(dataService.getItem).toHaveBeenCalledWith({
        pk: 'MASTER#TEST_TENANT',
        sk: 'MASTER_SETTING#SETTING1',
      })
      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'MASTER#TEST_TENANT#SETTING1#NEW_DATA',
          pk: 'MASTER#TEST_TENANT',
          sk: 'SETTING1#NEW_DATA',
          version: 0,
          type: 'MASTER',
          tenantCode: 'TEST_TENANT',
          code: createDto.code,
          settingCode: createDto.settingCode,
          name: createDto.name,
          isDeleted: false,
          attributes: createDto.attributes,
        }),
        expect.objectContaining({
          source: expect.stringContaining('createDataSetting'),
          invokeContext: mockInvokeContext,
        })
      )
      expect(result).toBeInstanceOf(DataSettingDataEntity)
    })

    it('should throw BadRequestException when data setting already exists', async () => {
      const tenantCode = 'TEST_TENANT'
      const createDto: CreateDataSettingDto = {
        settingCode: 'SETTING1',
        code: 'EXISTING_DATA',
        name: 'Existing Data Setting',
        attributes: { value: 'existing-value' },
      }

      const existingData = {
        pk: 'MASTER#TEST_TENANT',
        sk: 'SETTING1#EXISTING_DATA',
        id: 'existing-id',
        code: 'EXISTING_DATA',
        settingCode: 'SETTING1',
        name: 'Existing Data Setting',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: false,
        attributes: { value: 'existing-value' },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(existingData as any)

      await expect(
        service.create(tenantCode, createDto, { invokeContext: mockInvokeContext })
      ).rejects.toThrow(BadRequestException)
      await expect(
        service.create(tenantCode, createDto, { invokeContext: mockInvokeContext })
      ).rejects.toThrow('Data setting already exists')
    })

    it('should throw NotFoundException when setting code does not exist', async () => {
      const tenantCode = 'TEST_TENANT'
      const createDto: CreateDataSettingDto = {
        settingCode: 'NONEXISTENT_SETTING',
        code: 'NEW_DATA',
        name: 'New Data Setting',
        attributes: { value: 'new-value' },
      }

      dataService.getItem.mockImplementation((key) => {
        if (key.sk === 'NONEXISTENT_SETTING#NEW_DATA') {
          return Promise.resolve(null as any)
        }
        if (key.sk === 'MASTER_SETTING#NONEXISTENT_SETTING') {
          return Promise.resolve(null as any)
        }
        return Promise.resolve(null as any)
      })

      await expect(
        service.create(tenantCode, createDto, { invokeContext: mockInvokeContext })
      ).rejects.toThrow(NotFoundException)
      await expect(
        service.create(tenantCode, createDto, { invokeContext: mockInvokeContext })
      ).rejects.toThrow('Setting code does not exist')
    })

    it('should create when existing data setting is deleted', async () => {
      const tenantCode = 'TEST_TENANT'
      const createDto: CreateDataSettingDto = {
        settingCode: 'SETTING1',
        code: 'DELETED_DATA',
        name: 'Recreated Data Setting',
        attributes: { value: 'recreated-value' },
      }

      const deletedData = {
        pk: 'MASTER#TEST_TENANT',
        sk: 'SETTING1#DELETED_DATA',
        id: 'deleted-id',
        code: 'DELETED_DATA',
        settingCode: 'SETTING1',
        name: 'Deleted Data Setting',
        version: 2,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: true,
        attributes: { value: 'deleted-value' },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockSetting: SettingDataEntity = {
        pk: 'MASTER#TEST_TENANT',
        sk: 'MASTER_SETTING#SETTING1',
        id: 'setting-id',
        code: 'SETTING1',
        name: 'Setting 1',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: false,
        attributes: {
          fields: [
            { name: 'Field 1', physicalName: 'field1', dataType: 'string', isRequired: true, isShowedOnList: true },
          ],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any

      const mockCommandResult = {
        id: 'MASTER#TEST_TENANT#SETTING1#DELETED_DATA',
        pk: 'MASTER#TEST_TENANT',
        sk: 'SETTING1#DELETED_DATA',
        version: 2,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        code: createDto.code,
        settingCode: createDto.settingCode,
        name: createDto.name,
        isDeleted: false,
        attributes: createDto.attributes,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockImplementation((key) => {
        if (key.sk === 'SETTING1#DELETED_DATA') {
          return Promise.resolve(deletedData as any)
        }
        if (key.sk === 'MASTER_SETTING#SETTING1') {
          return Promise.resolve(mockSetting as any)
        }
        return Promise.resolve(null as any)
      })
      commandService.publishAsync.mockResolvedValue(mockCommandResult as any)

      const result = await service.create(tenantCode, createDto, { invokeContext: mockInvokeContext })

      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 2,
          isDeleted: false,
        }),
        expect.any(Object)
      )
      expect(result).toBeInstanceOf(DataSettingDataEntity)
    })
  })

  describe('update', () => {
    it('should update existing data setting', async () => {
      const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING1#DATA1' }
      const updateDto: UpdateDataSettingDto = {
        name: 'Updated Data Setting',
        attributes: { value: 'updated-value' },
      }

      const existingData = {
        id: 'test-id',
        pk: key.pk,
        sk: key.sk,
        code: 'DATA1',
        settingCode: 'SETTING1',
        name: 'Original Data Setting',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: false,
        attributes: { value: 'original-value' },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockSetting: SettingDataEntity = {
        pk: 'MASTER#TEST_TENANT',
        sk: 'MASTER_SETTING#SETTING1',
        id: 'setting-id',
        code: 'SETTING1',
        name: 'Setting 1',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: false,
        attributes: {
          fields: [
            { name: 'Field 1', physicalName: 'field1', dataType: 'string', isRequired: true, isShowedOnList: true },
          ],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any

      const mockUpdateResult = {
        ...existingData,
        name: updateDto.name,
        attributes: updateDto.attributes,
        updatedAt: new Date(),
      }

      dataService.getItem.mockImplementation((key) => {
        if (key.sk === 'SETTING1#DATA1') {
          return Promise.resolve(existingData as any)
        }
        if (key.sk === 'MASTER_SETTING#SETTING1') {
          return Promise.resolve(mockSetting as any)
        }
        return Promise.resolve(null as any)
      })
      commandService.publishAsync.mockResolvedValue(mockUpdateResult as any)

      const result = await service.update(key, updateDto, { invokeContext: mockInvokeContext })

      expect(dataService.getItem).toHaveBeenCalledWith(key)
      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: existingData.id,
          pk: existingData.pk,
          sk: existingData.sk,
          version: existingData.version,
          code: existingData.code,
          name: updateDto.name,
          type: existingData.type,
          tenantCode: existingData.tenantCode,
          isDeleted: existingData.isDeleted,
          attributes: updateDto.attributes,
        }),
        expect.objectContaining({
          source: expect.stringContaining('updateDataSetting'),
          invokeContext: mockInvokeContext,
        })
      )
      expect(result).toBeInstanceOf(DataSettingDataEntity)
    })

    it('should throw NotFoundException when data setting does not exist', async () => {
      const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING1#NONEXISTENT' }
      const updateDto: UpdateDataSettingDto = {
        name: 'Updated Data Setting',
      }

      dataService.getItem.mockResolvedValue(null as any)

      await expect(
        service.update(key, updateDto, { invokeContext: mockInvokeContext })
      ).rejects.toThrow(NotFoundException)
    })

    it('should preserve existing values when update fields are not provided', async () => {
      const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING1#DATA1' }
      const updateDto: UpdateDataSettingDto = {}

      const existingData = {
        id: 'test-id',
        pk: key.pk,
        sk: key.sk,
        code: 'DATA1',
        settingCode: 'SETTING1',
        name: 'Original Data Setting',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: false,
        attributes: { value: 'original-value' },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockUpdateResult = { ...existingData }

      dataService.getItem.mockResolvedValue(existingData as any)
      commandService.publishAsync.mockResolvedValue(mockUpdateResult as any)

      const result = await service.update(key, updateDto, { invokeContext: mockInvokeContext })

      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: existingData.name,
          isDeleted: existingData.isDeleted,
          attributes: existingData.attributes,
        }),
        expect.any(Object)
      )
      expect(result).toBeInstanceOf(DataSettingDataEntity)
    })

    it('should validate setting exists when updating attributes', async () => {
      const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING1#DATA1' }
      const updateDto: UpdateDataSettingDto = {
        attributes: { value: 'updated-value' },
      }

      const existingData = {
        id: 'test-id',
        pk: key.pk,
        sk: key.sk,
        code: 'DATA1',
        settingCode: 'SETTING1',
        name: 'Original Data Setting',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: false,
        attributes: { value: 'original-value' },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockImplementation((key) => {
        if (key.sk === 'SETTING1#DATA1') {
          return Promise.resolve(existingData as any)
        }
        if (key.sk === 'MASTER_SETTING#SETTING1') {
          return Promise.resolve(null as any)
        }
        return Promise.resolve(null as any)
      })

      await expect(
        service.update(key, updateDto, { invokeContext: mockInvokeContext })
      ).rejects.toThrow(NotFoundException)
      await expect(
        service.update(key, updateDto, { invokeContext: mockInvokeContext })
      ).rejects.toThrow('Setting code does not exist')
    })
  })

  describe('delete', () => {
    it('should soft delete existing data setting', async () => {
      const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING1#DATA1' }

      const existingData = {
        id: 'test-id',
        pk: key.pk,
        sk: key.sk,
        code: 'DATA1',
        settingCode: 'SETTING1',
        name: 'Data Setting 1',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: false,
        attributes: { value: 'test-value' },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockDeleteResult = {
        ...existingData,
        isDeleted: true,
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(existingData as any)
      commandService.publishAsync.mockResolvedValue(mockDeleteResult as any)

      const result = await service.delete(key, { invokeContext: mockInvokeContext })

      expect(dataService.getItem).toHaveBeenCalledWith(key)
      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          ...existingData,
          isDeleted: true,
        }),
        expect.objectContaining({
          source: expect.stringContaining('deleteDataSetting'),
          invokeContext: mockInvokeContext,
        })
      )
      expect(result).toBeInstanceOf(DataSettingDataEntity)
    })

    it('should throw NotFoundException when data setting does not exist', async () => {
      const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING1#NONEXISTENT' }

      dataService.getItem.mockResolvedValue(null as any)

      await expect(
        service.delete(key, { invokeContext: mockInvokeContext })
      ).rejects.toThrow(NotFoundException)
    })

    it('should throw BadRequestException when data setting is already deleted', async () => {
      const key = { pk: 'MASTER#TEST_TENANT', sk: 'SETTING1#DELETED_DATA' }

      const deletedData = {
        id: 'test-id',
        pk: key.pk,
        sk: key.sk,
        code: 'DELETED_DATA',
        settingCode: 'SETTING1',
        name: 'Deleted Data Setting',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: true,
        attributes: { value: 'deleted-value' },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(deletedData as any)

      await expect(
        service.delete(key, { invokeContext: mockInvokeContext })
      ).rejects.toThrow(BadRequestException)
      await expect(
        service.delete(key, { invokeContext: mockInvokeContext })
      ).rejects.toThrow('This data setting is already deleted')
    })
  })

  describe('checkExistCode', () => {
    it('should return true when data setting code exists and is not deleted', async () => {
      const tenantCode = 'TEST_TENANT'
      const settingCode = 'SETTING1'
      const code = 'EXISTING_DATA'

      const existingData = {
        id: 'test-id',
        pk: 'MASTER#TEST_TENANT',
        sk: 'SETTING1#EXISTING_DATA',
        code: 'EXISTING_DATA',
        settingCode: 'SETTING1',
        name: 'Existing Data Setting',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: false,
        attributes: { value: 'existing-value' },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(existingData as any)

      const result = await service.checkExistCode(tenantCode, settingCode, code)

      expect(dataService.getItem).toHaveBeenCalledWith({
        pk: 'MASTER#TEST_TENANT',
        sk: 'SETTING1#EXISTING_DATA',
      })
      expect(result).toBe(true)
    })

    it('should return false when data setting code does not exist', async () => {
      const tenantCode = 'TEST_TENANT'
      const settingCode = 'SETTING1'
      const code = 'NONEXISTENT_DATA'

      dataService.getItem.mockResolvedValue(null as any)

      const result = await service.checkExistCode(tenantCode, settingCode, code)

      expect(dataService.getItem).toHaveBeenCalledWith({
        pk: 'MASTER#TEST_TENANT',
        sk: 'SETTING1#NONEXISTENT_DATA',
      })
      expect(result).toBe(false)
    })

    it('should return false when data setting code exists but is deleted', async () => {
      const tenantCode = 'TEST_TENANT'
      const settingCode = 'SETTING1'
      const code = 'DELETED_DATA'

      const deletedData = {
        id: 'test-id',
        pk: 'MASTER#TEST_TENANT',
        sk: 'SETTING1#DELETED_DATA',
        code: 'DELETED_DATA',
        settingCode: 'SETTING1',
        name: 'Deleted Data Setting',
        version: 1,
        type: 'MASTER',
        tenantCode: 'TEST_TENANT',
        isDeleted: true,
        attributes: { value: 'deleted-value' },
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      dataService.getItem.mockResolvedValue(deletedData as any)

      const result = await service.checkExistCode(tenantCode, settingCode, code)

      expect(result).toBe(false)
    })
  })
})
