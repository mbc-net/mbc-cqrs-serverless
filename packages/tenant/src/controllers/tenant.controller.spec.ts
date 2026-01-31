/**
 * TenantController Test Suite
 *
 * Tests the REST API endpoints for tenant management.
 * Verifies controller-service integration and error handling.
 *
 * Endpoints tested:
 * - GET tenant: Retrieve tenant by key
 * - POST common tenant: Create shared tenant
 * - POST tenant: Create organization tenant
 * - PUT tenant: Update tenant details
 * - DELETE tenant: Soft delete tenant
 * - POST group: Add user group to tenant
 * - PUT groups: Customize tenant settings groups
 */
import { createMock } from '@golevelup/ts-jest'
import { Test, TestingModule } from '@nestjs/testing'
import { DetailDto, IInvoke } from '@mbc-cqrs-serverless/core'

import { TenantController } from './tenant.controller'
import { TenantService } from '../services'
import {
  CommonTenantCreateDto,
  TenantCreateDto,
  TenantGroupAddDto,
  TenantGroupUpdateDto,
  TenantUpdateDto,
} from '../dto'

describe('TenantController', () => {
  let controller: TenantController
  let service: TenantService

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
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantController],
      providers: [TenantService],
    })
      .useMocker(createMock)
      .compile()

    controller = module.get<TenantController>(TenantController)
    service = module.get<TenantService>(TenantService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  /** Tests for GET /tenant endpoint */
  describe('getTenant', () => {
    /** Successfully retrieves tenant data by pk/sk */
    it('should get tenant successfully', async () => {
      const dto: DetailDto = { pk: 'test-pk', sk: 'test-sk' }
      const expectedResult = {
        pk: 'TENANT#test-tenant',
        sk: 'test-sk',
        name: 'Test Tenant',
        version: 1,
      }

      jest.spyOn(service, 'getTenant').mockResolvedValue(expectedResult as any)

      const result = await controller.getTenant(dto)

      expect(service.getTenant).toHaveBeenCalledWith(dto)
      expect(result).toEqual(expectedResult)
    })

    /** Propagates service errors (e.g., tenant not found) */
    it('should handle service errors', async () => {
      const dto: DetailDto = { pk: 'test-pk', sk: 'test-sk' }
      const error = new Error('Tenant not found')

      jest.spyOn(service, 'getTenant').mockRejectedValue(error)

      await expect(controller.getTenant(dto)).rejects.toThrow('Tenant not found')
    })
  })

  /** Tests for POST /tenant/common endpoint */
  describe('createTenantCommon', () => {
    /** Creates common tenant and returns created entity */
    it('should create common tenant successfully', async () => {
      const dto: CommonTenantCreateDto = {
        name: 'Common Tenant',
        attributes: { description: 'Test common tenant' },
      }
      const expectedResult = {
        pk: 'TENANT#common-tenant',
        sk: 'common',
        name: 'Common Tenant',
        version: 1,
      }

      jest.spyOn(service, 'createCommonTenant').mockResolvedValue(expectedResult as any)

      const result = await controller.createTenantCommon(mockInvokeContext, dto)

      expect(service.createCommonTenant).toHaveBeenCalledWith(dto, {
        invokeContext: mockInvokeContext,
      })
      expect(result).toEqual(expectedResult)
    })

    /** Handles and propagates creation errors */
    it('should handle creation errors', async () => {
      const dto: CommonTenantCreateDto = {
        name: 'Common Tenant',
        attributes: { description: 'Test common tenant' },
      }
      const error = new Error('Creation failed')

      jest.spyOn(service, 'createCommonTenant').mockRejectedValue(error)

      await expect(
        controller.createTenantCommon(mockInvokeContext, dto),
      ).rejects.toThrow('Creation failed')
    })
  })

  /** Tests for POST /tenant endpoint */
  describe('createTenant', () => {
    /** Creates organization tenant with unique code */
    it('should create tenant successfully', async () => {
      const dto: TenantCreateDto = {
        name: 'New Tenant',
        code: 'NEW_TENANT',
        attributes: { description: 'Test new tenant' },
      }
      const expectedResult = {
        pk: 'TENANT#new-tenant',
        sk: 'NEW_TENANT',
        name: 'New Tenant',
        version: 1,
      }

      jest.spyOn(service, 'createTenant').mockResolvedValue(expectedResult as any)

      const result = await controller.createTenant(mockInvokeContext, dto)

      expect(service.createTenant).toHaveBeenCalledWith(dto, {
        invokeContext: mockInvokeContext,
      })
      expect(result).toEqual(expectedResult)
    })

    /** Handles duplicate code or validation errors */
    it('should handle creation errors', async () => {
      const dto: TenantCreateDto = {
        name: 'New Tenant',
        code: 'NEW_TENANT',
        attributes: { description: 'Test new tenant' },
      }
      const error = new Error('Tenant creation failed')

      jest.spyOn(service, 'createTenant').mockRejectedValue(error)

      await expect(
        controller.createTenant(mockInvokeContext, dto),
      ).rejects.toThrow('Tenant creation failed')
    })
  })

  /** Tests for PUT /tenant endpoint */
  describe('updateTenant', () => {
    /** Updates tenant and increments version */
    it('should update tenant successfully', async () => {
      const key: DetailDto = { pk: 'test-pk', sk: 'test-sk' }
      const dto: TenantUpdateDto = { name: 'Updated Tenant' }
      const expectedResult = {
        pk: 'TENANT#test-tenant',
        sk: 'test-sk',
        name: 'Updated Tenant',
        version: 2,
      }

      jest.spyOn(service, 'updateTenant').mockResolvedValue(expectedResult as any)

      const result = await controller.updateTenant(key, mockInvokeContext, dto)

      expect(service.updateTenant).toHaveBeenCalledWith(key, dto, {
        invokeContext: mockInvokeContext,
      })
      expect(result).toEqual(expectedResult)
    })

    /** Handles version conflict or not found errors */
    it('should handle update errors', async () => {
      const key: DetailDto = { pk: 'test-pk', sk: 'test-sk' }
      const dto: TenantUpdateDto = { name: 'Updated Tenant' }
      const error = new Error('Update failed')

      jest.spyOn(service, 'updateTenant').mockRejectedValue(error)

      await expect(
        controller.updateTenant(key, mockInvokeContext, dto),
      ).rejects.toThrow('Update failed')
    })
  })

  /** Tests for DELETE /tenant endpoint */
  describe('deleteTenant', () => {
    /** Soft deletes tenant (sets isDeleted=true) */
    it('should delete tenant successfully', async () => {
      const dto: DetailDto = { pk: 'test-pk', sk: 'test-sk' }
      const expectedResult = {
        pk: 'TENANT#test-tenant',
        sk: 'test-sk',
        isDeleted: true,
        version: 2,
      }

      jest.spyOn(service, 'deleteTenant').mockResolvedValue(expectedResult as any)

      const result = await controller.deleteTenant(dto, mockInvokeContext)

      expect(service.deleteTenant).toHaveBeenCalledWith(dto, {
        invokeContext: mockInvokeContext,
      })
      expect(result).toEqual(expectedResult)
    })

    /** Handles not found or permission errors */
    it('should handle deletion errors', async () => {
      const dto: DetailDto = { pk: 'test-pk', sk: 'test-sk' }
      const error = new Error('Deletion failed')

      jest.spyOn(service, 'deleteTenant').mockRejectedValue(error)

      await expect(
        controller.deleteTenant(dto, mockInvokeContext),
      ).rejects.toThrow('Deletion failed')
    })
  })

  /** Tests for POST /tenant/group endpoint */
  describe('addGroup', () => {
    /** Adds user group with role to tenant */
    it('should add tenant group successfully', async () => {
      const dto: TenantGroupAddDto = {
        tenantCode: 'test-tenant',
        groupId: 'test-group-id',
        role: 'admin',
      }
      const expectedResult = {
        pk: 'TENANT#test-tenant',
        sk: 'GROUP#test-group',
        name: 'Test Group',
        version: 1,
      }

      jest.spyOn(service, 'addTenantGroup').mockResolvedValue(expectedResult as any)

      const result = await controller.addGroup(dto, mockInvokeContext)

      expect(service.addTenantGroup).toHaveBeenCalledWith(dto, {
        invokeContext: mockInvokeContext,
      })
      expect(result).toEqual(expectedResult)
    })

    /** Handles invalid group or permission errors */
    it('should handle group addition errors', async () => {
      const dto: TenantGroupAddDto = {
        tenantCode: 'test-tenant',
        groupId: 'test-group-id',
        role: 'admin',
      }
      const error = new Error('Group addition failed')

      jest.spyOn(service, 'addTenantGroup').mockRejectedValue(error)

      await expect(
        controller.addGroup(dto, mockInvokeContext),
      ).rejects.toThrow('Group addition failed')
    })
  })

  /** Tests for PUT /tenant/groups endpoint */
  describe('customizeSettingGroups', () => {
    /** Updates tenant's setting groups configuration */
    it('should customize setting groups successfully', async () => {
      const dto: TenantGroupUpdateDto = {
        tenantCode: 'test-tenant',
        settingGroups: ['group1', 'group2'],
        role: 'admin',
      }
      const expectedResult = {
        pk: 'TENANT#test-tenant',
        sk: 'GROUP#updated-group',
        name: 'Updated Group',
        version: 2,
      }

      jest
        .spyOn(service, 'customizeSettingGroups')
        .mockResolvedValue(expectedResult as any)

      const result = await controller.customizeSettingGroups(
        mockInvokeContext,
        dto,
      )

      expect(service.customizeSettingGroups).toHaveBeenCalledWith(dto, {
        invokeContext: mockInvokeContext,
      })
      expect(result).toEqual(expectedResult)
    })

    /** Handles invalid settings or permission errors */
    it('should handle customization errors', async () => {
      const dto: TenantGroupUpdateDto = {
        tenantCode: 'test-tenant',
        settingGroups: ['group1', 'group2'],
        role: 'admin',
      }
      const error = new Error('Customization failed')

      jest.spyOn(service, 'customizeSettingGroups').mockRejectedValue(error)

      await expect(
        controller.customizeSettingGroups(mockInvokeContext, dto),
      ).rejects.toThrow('Customization failed')
    })
  })
})
