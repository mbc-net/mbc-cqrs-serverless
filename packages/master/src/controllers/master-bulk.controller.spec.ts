import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { IInvoke } from '@mbc-cqrs-serverless/core'

import { MasterBulkController } from './master-bulk.controller'
import { MasterDataService } from '../services/master-data.service'
import { MasterSettingService } from '../services/master-setting.service'

describe('MasterBulkController', () => {
  let controller: MasterBulkController
  let dataService: MasterDataService
  let settingService: MasterSettingService

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
      upsertBulk: jest.fn(),
    }

    const mockMasterDataService = {
      upsertBulk: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MasterBulkController],
      providers: [
        {
          provide: MasterSettingService,
          useValue: mockMasterSettingService,
        },
        {
          provide: MasterDataService,
          useValue: mockMasterDataService,
        },
      ],
    }).compile()

    controller = module.get<MasterBulkController>(MasterBulkController)
    dataService = module.get<MasterDataService>(MasterDataService)
    settingService = module.get<MasterSettingService>(MasterSettingService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('createBulk', () => {
    it('should route items with settingCode to dataService.upsertBulk', async () => {
      const bulkDto = {
        items: [
          {
            name: 'Data 1',
            code: 'CODE1',
            settingCode: 'SETTING1',
            seq: 1,
            attributes: { key: 'value1' },
          },
          {
            name: 'Data 2',
            code: 'CODE2',
            settingCode: 'SETTING2',
            seq: 2,
            attributes: { key: 'value2' },
          },
        ],
      }

      const dataResults = [
        { pk: 'MASTER#test-tenant', sk: 'DATA#CODE1', name: 'Data 1' },
        { pk: 'MASTER#test-tenant', sk: 'DATA#CODE2', name: 'Data 2' },
      ]

      jest
        .spyOn(dataService, 'upsertBulk')
        .mockResolvedValue(dataResults as any)

      const result = await controller.createBulk(
        bulkDto as any,
        mockInvokeContext,
      )

      expect(settingService.upsertBulk).not.toHaveBeenCalled()
      expect(dataService.upsertBulk).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            expect.objectContaining({
              settingCode: 'SETTING1',
              code: 'CODE1',
              name: 'Data 1',
              seq: 1,
            }),
            expect.objectContaining({
              settingCode: 'SETTING2',
              code: 'CODE2',
              name: 'Data 2',
              seq: 2,
            }),
          ],
        }),
        mockInvokeContext,
      )
      expect(result).toEqual(dataResults)
    })

    it('should route items without settingCode to settingService.upsertBulk', async () => {
      const bulkDto = {
        items: [
          {
            name: 'Setting 1',
            code: 'SET1',
            attributes: { description: 'A setting' },
          },
        ],
      }

      const settingResults = [
        { pk: 'MASTER#test-tenant', sk: 'SETTING#SET1', name: 'Setting 1' },
      ]

      jest
        .spyOn(settingService, 'upsertBulk')
        .mockResolvedValue(settingResults as any)

      const result = await controller.createBulk(
        bulkDto as any,
        mockInvokeContext,
      )

      expect(dataService.upsertBulk).not.toHaveBeenCalled()
      expect(settingService.upsertBulk).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            expect.objectContaining({
              code: 'SET1',
              name: 'Setting 1',
              settingValue: { description: 'A setting' },
            }),
          ],
        }),
        mockInvokeContext,
      )
      expect(result).toEqual(settingResults)
    })

    it('should route mixed items to both services and preserve input order', async () => {
      const bulkDto = {
        items: [
          {
            name: 'Setting 1',
            code: 'SET1',
            attributes: { description: 'A setting' },
          },
          {
            name: 'Data 1',
            code: 'CODE1',
            settingCode: 'SETTING1',
            seq: 1,
            attributes: { key: 'value1' },
          },
          {
            name: 'Setting 2',
            code: 'SET2',
            attributes: { description: 'Another setting' },
          },
        ],
      }

      const settingResults = [{ name: 'Setting 1' }, { name: 'Setting 2' }]
      const dataResults = [{ name: 'Data 1' }]

      jest
        .spyOn(settingService, 'upsertBulk')
        .mockResolvedValue(settingResults as any)
      jest
        .spyOn(dataService, 'upsertBulk')
        .mockResolvedValue(dataResults as any)

      const result = await controller.createBulk(
        bulkDto as any,
        mockInvokeContext,
      )

      expect(settingService.upsertBulk).toHaveBeenCalled()
      expect(dataService.upsertBulk).toHaveBeenCalled()
      // Results should maintain original input order:
      // index 0: Setting 1, index 1: Data 1, index 2: Setting 2
      expect(result).toEqual([
        { name: 'Setting 1' },
        { name: 'Data 1' },
        { name: 'Setting 2' },
      ])
    })

    it('should throw BadRequestException for mismatching tenant code', async () => {
      const bulkDto = {
        items: [
          {
            name: 'Setting 1',
            code: 'SET1',
            tenantCode: 'other-tenant',
            attributes: { description: 'A setting' },
          },
        ],
      }

      await expect(
        controller.createBulk(bulkDto as any, mockInvokeContext),
      ).rejects.toThrow(BadRequestException)

      await expect(
        controller.createBulk(bulkDto as any, mockInvokeContext),
      ).rejects.toThrow('Invalid tenant code: other-tenant')
    })

    it('should allow matching tenant code', async () => {
      const bulkDto = {
        items: [
          {
            name: 'Setting 1',
            code: 'SET1',
            tenantCode: 'test-tenant',
            attributes: { description: 'A setting' },
          },
        ],
      }

      jest
        .spyOn(settingService, 'upsertBulk')
        .mockResolvedValue([{ name: 'Setting 1' }] as any)

      const result = await controller.createBulk(
        bulkDto as any,
        mockInvokeContext,
      )

      expect(settingService.upsertBulk).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            expect.objectContaining({
              tenantCode: 'test-tenant',
            }),
          ],
        }),
        mockInvokeContext,
      )
      expect(result).toHaveLength(1)
    })

    it('should allow omitted tenant code', async () => {
      const bulkDto = {
        items: [
          {
            name: 'Setting 1',
            code: 'SET1',
            attributes: { description: 'A setting' },
          },
        ],
      }

      jest
        .spyOn(settingService, 'upsertBulk')
        .mockResolvedValue([{ name: 'Setting 1' }] as any)

      const result = await controller.createBulk(
        bulkDto as any,
        mockInvokeContext,
      )

      expect(settingService.upsertBulk).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            expect.objectContaining({
              tenantCode: undefined,
            }),
          ],
        }),
        mockInvokeContext,
      )
      expect(result).toHaveLength(1)
    })

    it('should propagate service errors', async () => {
      const bulkDto = {
        items: [
          {
            name: 'Data 1',
            code: 'CODE1',
            settingCode: 'SETTING1',
            seq: 1,
            attributes: { key: 'value1' },
          },
        ],
      }

      jest
        .spyOn(dataService, 'upsertBulk')
        .mockRejectedValue(new Error('Database error'))

      await expect(
        controller.createBulk(bulkDto as any, mockInvokeContext),
      ).rejects.toThrow('Database error')
    })
  })
})
