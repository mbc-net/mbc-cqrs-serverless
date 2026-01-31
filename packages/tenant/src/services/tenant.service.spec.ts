/**
 * TenantService Test Suite
 *
 * Tests multi-tenant management functionality including:
 * - Creating common (shared) tenants
 * - Creating individual tenants with unique codes
 * - Re-creating tenants after soft delete
 * - Updating and deleting tenants
 * - Managing tenant groups and settings
 *
 * Multi-tenancy model:
 * - COMMON tenant: Shared resources across all tenants
 * - Individual tenants: Isolated data per organization
 * - Partition key format: TENANT#{tenantCode}
 */
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
import { BadRequestException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'

import { TenantService } from './tenant.service'
import {
  CommonTenantCreateDto,
  TenantCreateDto,
  TenantGroupAddDto,
  TenantGroupUpdateDto,
  TenantUpdateDto,
} from '../dto'

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

describe('Tenant', () => {
  let service: TenantService
  let dataService: DataService
  let commandService: CommandService
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
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

    service = module.get<TenantService>(TenantService)
    dataService = module.get<DataService>(DataService)
    commandService = module.get<CommandService>(CommandService)
  })
  //
  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  /**
   * Tests for createCommonTenant method
   * Scenario: Creating the shared COMMON tenant for cross-tenant resources
   */
  describe('createCommonTenant', () => {
    afterEach(() => {
      jest.clearAllMocks()
    })
    /** Creates new common tenant with version 1 */
    it('should create a new common tenant', async () => {
      const mockResponse = {
        pk: 'TENANT#COMMON',
        sk: 'MASTER',
        id: 'TENANT#COMMON#MASTER',
        attributes: {},
        code: 'MASTER',
        version: 1,
        tenantCode: 'common',
        name: 'MBC',
        type: 'common',
      }

      const dto: CommonTenantCreateDto = {
        name: 'MBC',
      }

      jest.spyOn(commandService, 'publishAsync').mockResolvedValue({
        pk: 'TENANT#COMMON',
        sk: 'MASTER',
        id: 'TENANT#COMMON#MASTER',
        attributes: {},
        code: 'MASTER',
        version: 1,
        tenantCode: 'common',
        name: 'MBC',
        type: 'common',
      })
      const result = await service.createCommonTenant(dto, optionsMock)

      expect(result).toEqual(mockResponse)
    })
    /** Re-creates tenant after soft delete - increments version from deleted record */
    it('should create a new common tenant with the same code after delete', async () => {
      const mockResponse = {
        pk: 'TENANT#COMMON',
        sk: 'MASTER',
        id: 'TENANT#COMMON#MASTER',
        attributes: {},
        code: 'MASTER',
        version: 3,
        tenantCode: 'common',
        name: 'MBC',
        type: 'common',
      }

      const dto: CommonTenantCreateDto = {
        name: 'MBC',
      }

      jest.spyOn(dataService, 'getItem').mockResolvedValue({
        pk: 'TENANT#COMMON',
        sk: 'MASTER',
        id: 'TENANT#COMMON#MASTER',
        attributes: {},
        code: 'MASTER',
        version: 2,
        tenantCode: 'common',
        name: 'MBC',
        type: 'common',
        isDeleted: true,
      })

      jest.spyOn(commandService, 'publishAsync').mockResolvedValue({
        pk: 'TENANT#COMMON',
        sk: 'MASTER',
        id: 'TENANT#COMMON#MASTER',
        attributes: {},
        code: 'MASTER',
        version: 3,
        tenantCode: 'common',
        name: 'MBC',
        type: 'common',
      })
      const result = await service.createCommonTenant(dto, optionsMock)

      expect(result).toEqual(mockResponse)
    })
  })

  /**
   * Tests for createTenant method
   * Scenario: Creating individual organization tenants with unique codes
   */
  describe('createTenant', () => {
    afterEach(() => {
      jest.clearAllMocks()
    })
    /** Creates new tenant with provided code and name */
    it('should create a new tenant', async () => {
      const mockResponse = {
        pk: 'TENANT#MBC',
        sk: 'MASTER',
        id: 'TENANT#COMMON#MASTER',
        attributes: {},
        code: 'MASTER',
        version: 1,
        tenantCode: 'MBC',
        name: 'MBC, Inc',
        type: 'MBC',
      }

      const dto: TenantCreateDto = {
        name: 'MBC, Inc',
        code: 'MBC',
      }

      jest.spyOn(commandService, 'publishAsync').mockResolvedValue({
        pk: 'TENANT#MBC',
        sk: 'MASTER',
        id: 'TENANT#COMMON#MASTER',
        attributes: {},
        code: 'MASTER',
        version: 1,
        tenantCode: 'MBC',
        name: 'MBC, Inc',
        type: 'MBC',
      })
      const result = await service.createCommonTenant(dto, optionsMock)

      expect(result).toEqual(mockResponse)
    })
    /** Re-creates tenant after soft delete - preserves code, increments version */
    it('should create a new tenant with the same code after delete', async () => {
      const mockResponse = {
        pk: 'TENANT#MBC',
        sk: 'MASTER',
        id: 'TENANT#COMMON#MASTER',
        attributes: {},
        code: 'MASTER',
        version: 3,
        tenantCode: 'MBC',
        name: 'MBC, Inc',
        type: 'MBC',
      }

      const dto: TenantCreateDto = {
        name: 'MBC, Inc',
        code: 'MBC',
      }

      jest.spyOn(dataService, 'getItem').mockResolvedValue({
        pk: 'TENANT#MBC',
        sk: 'MASTER',
        id: 'TENANT#COMMON#MASTER',
        attributes: {},
        code: 'MASTER',
        version: 2,
        tenantCode: 'MBC',
        name: 'MBC, Inc',
        type: 'MBC',
        isDeleted: true,
      })

      jest.spyOn(commandService, 'publishAsync').mockResolvedValue({
        pk: 'TENANT#MBC',
        sk: 'MASTER',
        id: 'TENANT#COMMON#MASTER',
        attributes: {},
        code: 'MASTER',
        version: 3,
        tenantCode: 'MBC',
        name: 'MBC, Inc',
        type: 'MBC',
      })
      const result = await service.createCommonTenant(dto, optionsMock)

      expect(result).toEqual(mockResponse)
    })
  })

  /**
   * Tests for getTenant method
   * Scenario: Retrieving tenant data by key
   */
  describe('getTenant', () => {
    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should return tenant data for valid key', async () => {
      const mockTenant = {
        pk: 'TENANT#MBC',
        sk: 'MASTER',
        id: 'TENANT#MBC#MASTER',
        name: 'MBC, Inc',
        code: 'MASTER',
        tenantCode: 'MBC',
        type: 'MBC',
        version: 1,
      }

      jest.spyOn(dataService, 'getItem').mockResolvedValue(mockTenant)

      const result = await service.getTenant({ pk: 'TENANT#MBC', sk: 'MASTER' })

      expect(result).toEqual(mockTenant)
      expect(dataService.getItem).toHaveBeenCalledWith({
        pk: 'TENANT#MBC',
        sk: 'MASTER',
      })
    })

    it('should return null for non-existent tenant', async () => {
      jest.spyOn(dataService, 'getItem').mockResolvedValue(null as any)

      const result = await service.getTenant({
        pk: 'TENANT#NOTFOUND',
        sk: 'MASTER',
      })

      expect(result).toBeNull()
    })
  })

  /**
   * Tests for updateTenant method
   * Scenario: Updating existing tenant information
   */
  describe('updateTenant', () => {
    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should update tenant name and attributes', async () => {
      const existingTenant = {
        pk: 'TENANT#MBC',
        sk: 'MASTER',
        id: 'TENANT#MBC#MASTER',
        name: 'MBC, Inc',
        code: 'MASTER',
        tenantCode: 'MBC',
        type: 'MBC',
        version: 2,
        attributes: { existingAttr: 'value' },
      }

      const updateDto: TenantUpdateDto = {
        name: 'MBC Corporation',
        attributes: { newAttr: 'newValue' },
      }

      const mockResponse = {
        pk: 'TENANT#MBC',
        sk: 'MASTER',
        id: 'TENANT#MBC#MASTER',
        name: 'MBC Corporation',
        code: 'MASTER',
        tenantCode: 'MBC',
        type: 'MBC',
        version: 3,
        attributes: { existingAttr: 'value', newAttr: 'newValue' },
      }

      jest.spyOn(dataService, 'getItem').mockResolvedValue(existingTenant)
      jest
        .spyOn(commandService, 'publishPartialUpdateAsync')
        .mockResolvedValue(mockResponse)

      const result = await service.updateTenant(
        { pk: 'TENANT#MBC', sk: 'MASTER' },
        updateDto,
        optionsMock,
      )

      expect(result).toEqual(mockResponse)
      expect(commandService.publishPartialUpdateAsync).toHaveBeenCalledWith(
        {
          pk: 'TENANT#MBC',
          sk: 'MASTER',
          name: 'MBC Corporation',
          attributes: { existingAttr: 'value', newAttr: 'newValue' },
          version: 2,
        },
        optionsMock,
      )
    })

    it('should throw BadRequestException when tenant not found', async () => {
      jest.spyOn(dataService, 'getItem').mockResolvedValue(null as any)

      const updateDto: TenantUpdateDto = {
        name: 'New Name',
      }

      await expect(
        service.updateTenant(
          { pk: 'TENANT#NOTFOUND', sk: 'MASTER' },
          updateDto,
          optionsMock,
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('should merge attributes when updating', async () => {
      const existingTenant = {
        pk: 'TENANT#MBC',
        sk: 'MASTER',
        id: 'TENANT#MBC#MASTER',
        name: 'MBC',
        code: 'MASTER',
        tenantCode: 'MBC',
        type: 'MBC',
        version: 1,
        attributes: { a: 1, b: 2 },
      }

      const updateDto: TenantUpdateDto = {
        attributes: { b: 3, c: 4 },
      }

      jest.spyOn(dataService, 'getItem').mockResolvedValue(existingTenant)
      jest
        .spyOn(commandService, 'publishPartialUpdateAsync')
        .mockResolvedValue({} as any)

      await service.updateTenant(
        { pk: 'TENANT#MBC', sk: 'MASTER' },
        updateDto,
        optionsMock,
      )

      expect(commandService.publishPartialUpdateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: { a: 1, b: 3, c: 4 },
        }),
        optionsMock,
      )
    })
  })

  /**
   * Tests for deleteTenant method
   * Scenario: Soft deleting a tenant (setting isDeleted flag)
   */
  describe('deleteTenant', () => {
    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should soft delete an existing tenant', async () => {
      const existingTenant = {
        pk: 'TENANT#MBC',
        sk: 'MASTER',
        id: 'TENANT#MBC#MASTER',
        name: 'MBC, Inc',
        code: 'MASTER',
        tenantCode: 'MBC',
        type: 'MBC',
        version: 2,
        isDeleted: false,
      }

      const mockResponse = {
        pk: 'TENANT#MBC',
        sk: 'MASTER',
        id: 'TENANT#MBC#MASTER',
        name: 'MBC, Inc',
        code: 'MASTER',
        tenantCode: 'MBC',
        type: 'MBC',
        version: 3,
        isDeleted: true,
      }

      jest.spyOn(dataService, 'getItem').mockResolvedValue(existingTenant)
      jest
        .spyOn(commandService, 'publishPartialUpdateAsync')
        .mockResolvedValue(mockResponse)

      const result = await service.deleteTenant(
        { pk: 'TENANT#MBC', sk: 'MASTER' },
        optionsMock,
      )

      expect(result).toEqual(mockResponse)
      expect(commandService.publishPartialUpdateAsync).toHaveBeenCalledWith(
        {
          pk: 'TENANT#MBC',
          sk: 'MASTER',
          version: 2,
          isDeleted: true,
        },
        optionsMock,
      )
    })

    it('should throw BadRequestException when tenant not found', async () => {
      jest.spyOn(dataService, 'getItem').mockResolvedValue(null as any)

      await expect(
        service.deleteTenant(
          { pk: 'TENANT#NOTFOUND', sk: 'MASTER' },
          optionsMock,
        ),
      ).rejects.toThrow(BadRequestException)
    })
  })

  /**
   * Tests for addTenantGroup method
   * Scenario: Adding group to tenant settings
   */
  describe('addTenantGroup', () => {
    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should add group to tenant without existing settings', async () => {
      const existingTenant = {
        pk: 'TENANT#MBC',
        sk: 'MASTER',
        id: 'TENANT#MBC#MASTER',
        name: 'MBC',
        code: 'MASTER',
        tenantCode: 'MBC',
        type: 'MBC',
        version: 1,
        attributes: {},
      }

      const dto: TenantGroupAddDto = {
        tenantCode: 'MBC',
        groupId: 'GROUP1',
        role: 'admin',
      }

      jest.spyOn(dataService, 'getItem').mockResolvedValue(existingTenant)
      jest
        .spyOn(commandService, 'publishPartialUpdateAsync')
        .mockResolvedValue({} as any)

      await service.addTenantGroup(dto, optionsMock)

      expect(commandService.publishPartialUpdateAsync).toHaveBeenCalledWith(
        {
          pk: 'TENANT#MBC',
          sk: 'MASTER',
          version: 1,
          attributes: {
            setting: [
              {
                tenantRole: 'admin',
                groups: ['GROUP1'],
                setting_groups: ['GROUP1'],
                setting_groups_mode: 'auto',
              },
            ],
          },
        },
        optionsMock,
      )
    })

    it('should add group to existing role settings', async () => {
      const existingTenant = {
        pk: 'TENANT#MBC',
        sk: 'MASTER',
        id: 'TENANT#MBC#MASTER',
        name: 'MBC',
        code: 'MASTER',
        tenantCode: 'MBC',
        type: 'MBC',
        version: 1,
        attributes: {
          setting: [
            {
              tenantRole: 'admin',
              groups: ['GROUP1'],
              setting_groups: ['GROUP1'],
              setting_groups_mode: 'auto',
            },
          ],
        },
      }

      const dto: TenantGroupAddDto = {
        tenantCode: 'MBC',
        groupId: 'GROUP2',
        role: 'admin',
      }

      jest.spyOn(dataService, 'getItem').mockResolvedValue(existingTenant)
      jest
        .spyOn(commandService, 'publishPartialUpdateAsync')
        .mockResolvedValue({} as any)

      await service.addTenantGroup(dto, optionsMock)

      expect(commandService.publishPartialUpdateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: {
            setting: [
              expect.objectContaining({
                tenantRole: 'admin',
                groups: ['GROUP1', 'GROUP2'],
              }),
            ],
          },
        }),
        optionsMock,
      )
    })

    it('should not add duplicate group', async () => {
      const existingTenant = {
        pk: 'TENANT#MBC',
        sk: 'MASTER',
        id: 'TENANT#MBC#MASTER',
        name: 'MBC',
        code: 'MASTER',
        tenantCode: 'MBC',
        type: 'MBC',
        version: 1,
        attributes: {
          setting: [
            {
              tenantRole: 'admin',
              groups: ['GROUP1'],
              setting_groups: ['GROUP1'],
              setting_groups_mode: 'auto',
            },
          ],
        },
      }

      const dto: TenantGroupAddDto = {
        tenantCode: 'MBC',
        groupId: 'GROUP1',
        role: 'admin',
      }

      jest.spyOn(dataService, 'getItem').mockResolvedValue(existingTenant)
      jest
        .spyOn(commandService, 'publishPartialUpdateAsync')
        .mockResolvedValue({} as any)

      await service.addTenantGroup(dto, optionsMock)

      expect(commandService.publishPartialUpdateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: {
            setting: [
              expect.objectContaining({
                groups: ['GROUP1'],
              }),
            ],
          },
        }),
        optionsMock,
      )
    })

    it('should throw BadRequestException when tenant not found', async () => {
      jest.spyOn(dataService, 'getItem').mockResolvedValue(null as any)

      const dto: TenantGroupAddDto = {
        tenantCode: 'NOTFOUND',
        groupId: 'GROUP1',
        role: 'admin',
      }

      await expect(service.addTenantGroup(dto, optionsMock)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('should create new role entry when role does not exist', async () => {
      const existingTenant = {
        pk: 'TENANT#MBC',
        sk: 'MASTER',
        id: 'TENANT#MBC#MASTER',
        name: 'MBC',
        code: 'MASTER',
        tenantCode: 'MBC',
        type: 'MBC',
        version: 1,
        attributes: {
          setting: [
            {
              tenantRole: 'admin',
              groups: ['GROUP1'],
              setting_groups: ['GROUP1'],
              setting_groups_mode: 'auto',
            },
          ],
        },
      }

      const dto: TenantGroupAddDto = {
        tenantCode: 'MBC',
        groupId: 'GROUP2',
        role: 'user',
      }

      jest.spyOn(dataService, 'getItem').mockResolvedValue(existingTenant)
      jest
        .spyOn(commandService, 'publishPartialUpdateAsync')
        .mockResolvedValue({} as any)

      await service.addTenantGroup(dto, optionsMock)

      expect(commandService.publishPartialUpdateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: {
            setting: [
              expect.objectContaining({ tenantRole: 'admin' }),
              expect.objectContaining({
                tenantRole: 'user',
                groups: ['GROUP2'],
              }),
            ],
          },
        }),
        optionsMock,
      )
    })
  })

  /**
   * Tests for customizeSettingGroups method
   * Scenario: Customizing setting groups for a tenant role
   */
  describe('customizeSettingGroups', () => {
    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should customize setting groups for a role', async () => {
      const existingTenant = {
        pk: 'TENANT#MBC',
        sk: 'MASTER',
        id: 'TENANT#MBC#MASTER',
        name: 'MBC',
        code: 'MASTER',
        tenantCode: 'MBC',
        type: 'MBC',
        version: 1,
        attributes: {
          setting: [
            {
              tenantRole: 'admin',
              groups: ['GROUP1', 'GROUP2'],
              setting_groups: ['GROUP1', 'GROUP2'],
              setting_groups_mode: 'auto',
            },
          ],
        },
      }

      const dto: TenantGroupUpdateDto = {
        tenantCode: 'MBC',
        settingGroups: ['GROUP2', 'GROUP1'],
        role: 'admin',
      }

      jest.spyOn(dataService, 'getItem').mockResolvedValue(existingTenant)
      jest
        .spyOn(commandService, 'publishPartialUpdateAsync')
        .mockResolvedValue({} as any)

      await service.customizeSettingGroups(dto, optionsMock)

      expect(commandService.publishPartialUpdateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.objectContaining({
            setting: [
              expect.objectContaining({
                tenantRole: 'admin',
                groups: ['GROUP2', 'GROUP1'],
                setting_groups: ['GROUP2', 'GROUP1'],
                setting_groups_mode: 'customized',
              }),
            ],
          }),
        }),
        optionsMock,
      )
    })

    it('should throw BadRequestException when tenant not found', async () => {
      jest.spyOn(dataService, 'getItem').mockResolvedValue(null as any)

      const dto: TenantGroupUpdateDto = {
        tenantCode: 'NOTFOUND',
        settingGroups: ['GROUP1'],
        role: 'admin',
      }

      await expect(
        service.customizeSettingGroups(dto, optionsMock),
      ).rejects.toThrow(BadRequestException)
    })
  })

  /**
   * Tests for createTenantGroup method
   * Scenario: Creating a tenant group within a tenant
   */
  describe('createTenantGroup', () => {
    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should create a new tenant group', async () => {
      const dto: TenantCreateDto = {
        name: 'Sales Team',
        code: 'SALES',
      }

      const mockResponse = {
        pk: 'TENANT#MBC',
        sk: 'SALES',
        id: 'TENANT#MBC#SALES',
        name: 'Sales Team',
        code: 'SALES',
        tenantCode: 'MBC',
        type: 'TENANT',
        version: 1,
      }

      jest.spyOn(dataService, 'getItem').mockResolvedValue(null as any)
      jest.spyOn(commandService, 'publishAsync').mockResolvedValue(mockResponse)

      const result = await service.createTenantGroup('MBC', dto, optionsMock)

      expect(result).toEqual(mockResponse)
      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          pk: 'TENANT#MBC',
          sk: 'SALES',
          name: 'Sales Team',
          code: 'SALES',
          tenantCode: 'MBC',
          type: 'TENANT',
          version: VERSION_FIRST, // VERSION_FIRST = 0
        }),
        optionsMock,
      )
    })

    it('should throw BadRequestException when tenant group already exists', async () => {
      const existingGroup = {
        pk: 'TENANT#MBC',
        sk: 'SALES',
        id: 'TENANT#MBC#SALES',
        name: 'Sales Team',
        code: 'SALES',
        tenantCode: 'MBC',
        type: 'TENANT',
        version: 1,
        isDeleted: false,
      }

      const dto: TenantCreateDto = {
        name: 'Sales Team',
        code: 'SALES',
      }

      jest.spyOn(dataService, 'getItem').mockResolvedValue(existingGroup)

      await expect(
        service.createTenantGroup('MBC', dto, optionsMock),
      ).rejects.toThrow(BadRequestException)
    })

    it('should recreate tenant group after soft delete', async () => {
      const deletedGroup = {
        pk: 'TENANT#MBC',
        sk: 'SALES',
        id: 'TENANT#MBC#SALES',
        name: 'Sales Team',
        code: 'SALES',
        tenantCode: 'MBC',
        type: 'TENANT',
        version: 2,
        isDeleted: true,
      }

      const dto: TenantCreateDto = {
        name: 'Sales Team New',
        code: 'SALES',
      }

      const mockResponse = {
        pk: 'TENANT#MBC',
        sk: 'SALES',
        id: 'TENANT#MBC#SALES',
        name: 'Sales Team New',
        code: 'SALES',
        tenantCode: 'MBC',
        type: 'TENANT',
        version: 3,
        isDeleted: false,
      }

      jest.spyOn(dataService, 'getItem').mockResolvedValue(deletedGroup)
      jest.spyOn(commandService, 'publishAsync').mockResolvedValue(mockResponse)

      const result = await service.createTenantGroup('MBC', dto, optionsMock)

      expect(result).toEqual(mockResponse)
      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 2,
          isDeleted: false,
        }),
        optionsMock,
      )
    })
  })
})
