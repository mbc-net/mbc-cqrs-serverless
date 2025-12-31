/**
 * TenantService Test Suite
 *
 * Tests multi-tenant management functionality including:
 * - Creating common (shared) tenants
 * - Creating individual tenants with unique codes
 * - Re-creating tenants after soft delete
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
import { Test, TestingModule } from '@nestjs/testing'

import { TenantService } from './tenant.service'
import { CommonTenantCreateDto, TenantCreateDto } from '../dto'

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
        tenantCode: 'COMMON',
        name: 'MBC',
        type: 'COMMON',
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
        tenantCode: 'COMMON',
        name: 'MBC',
        type: 'COMMON',
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
        tenantCode: 'COMMON',
        name: 'MBC',
        type: 'COMMON',
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
        tenantCode: 'COMMON',
        name: 'MBC',
        type: 'COMMON',
        isDeleted: true,
      })

      jest.spyOn(commandService, 'publishAsync').mockResolvedValue({
        pk: 'TENANT#COMMON',
        sk: 'MASTER',
        id: 'TENANT#COMMON#MASTER',
        attributes: {},
        code: 'MASTER',
        version: 3,
        tenantCode: 'COMMON',
        name: 'MBC',
        type: 'COMMON',
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
})
