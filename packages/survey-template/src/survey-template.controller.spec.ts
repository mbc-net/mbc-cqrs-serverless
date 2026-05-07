import { Test, TestingModule } from '@nestjs/testing'
import {
  DetailDto,
  getUserContext,
  IInvoke,
  SearchDto,
} from '@mbc-cqrs-serverless/core'

import { SurveyTemplateController } from './survey-template.controller'
import { SurveyTemplateService } from './survey-template.service'
import { SurveyTemplateCreateDto } from './dto/survey-template-create.dto'
import { SurveyTemplateUpdateDto } from './dto/survey-template-update.dto'
import { SurveyTemplateDataEntity } from './entity/survey-template-data.entity'
import { SurveyTemplateDataListEntity } from './entity/survey-template-data-list.entity'

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

describe('SurveyTemplateController', () => {
  let controller: SurveyTemplateController
  let service: jest.Mocked<SurveyTemplateService>

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

  const mockService = {
    searchData: jest.fn(),
    create: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  }

  beforeEach(async () => {
    // Default mock for getUserContext
    mockGetUserContext.mockReturnValue({
      tenantCode: 'test-tenant',
      userId: 'test-user',
    } as any)

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SurveyTemplateController],
      providers: [
        {
          provide: SurveyTemplateService,
          useValue: mockService,
        },
      ],
    }).compile()

    controller = module.get<SurveyTemplateController>(SurveyTemplateController)
    service = module.get(SurveyTemplateService) as jest.Mocked<SurveyTemplateService>
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('searchData', () => {
    it('should search survey templates successfully', async () => {
      const searchDto: SearchDto = { keyword: 'test' }
      const mockResult = new SurveyTemplateDataListEntity({
        total: 1,
        items: [
          new SurveyTemplateDataEntity({
            pk: 'SURVEY#test-tenant',
            sk: 'TEMPLATE#01HTEST',
            name: 'Test Survey',
          } as any),
        ],
      })

      mockService.searchData.mockResolvedValue(mockResult)

      const result = await controller.searchData(searchDto, mockInvokeContext)

      expect(service.searchData).toHaveBeenCalledWith('test-tenant', searchDto)
      expect(result).toEqual(mockResult)
    })

    it('should use tenant from user context', async () => {
      mockGetUserContext.mockReturnValue({
        tenantCode: 'custom-tenant',
        userId: 'test-user',
      } as any)

      const searchDto: SearchDto = {}
      const mockResult = new SurveyTemplateDataListEntity({
        total: 0,
        items: [],
      })

      mockService.searchData.mockResolvedValue(mockResult)

      await controller.searchData(searchDto, mockInvokeContext)

      expect(service.searchData).toHaveBeenCalledWith(
        'custom-tenant',
        searchDto,
      )
    })

    it('should handle service errors', async () => {
      const searchDto: SearchDto = {}
      const error = new Error('Search failed')

      mockService.searchData.mockRejectedValue(error)

      await expect(
        controller.searchData(searchDto, mockInvokeContext),
      ).rejects.toThrow('Search failed')
    })
  })

  describe('create', () => {
    it('should create survey template successfully', async () => {
      const createDto: SurveyTemplateCreateDto = {
        name: 'New Survey',
        attributes: { surveyTemplate: {} },
      } as any

      const mockResult = new SurveyTemplateDataEntity({
        pk: 'SURVEY#test-tenant',
        sk: 'TEMPLATE#01HTEST',
        name: 'New Survey',
        version: 1,
      } as any)

      mockService.create.mockResolvedValue(mockResult)

      const result = await controller.create(mockInvokeContext, createDto)

      expect(service.create).toHaveBeenCalledWith(createDto, {
        invokeContext: mockInvokeContext,
      })
      expect(result).toEqual(mockResult)
    })

    it('should handle creation errors', async () => {
      const createDto: SurveyTemplateCreateDto = {
        name: 'New Survey',
        attributes: {},
      } as any
      const error = new Error('Creation failed')

      mockService.create.mockRejectedValue(error)

      await expect(
        controller.create(mockInvokeContext, createDto),
      ).rejects.toThrow('Creation failed')
    })
  })

  describe('getData', () => {
    it('should get survey template by id successfully', async () => {
      const detailDto: DetailDto = {
        pk: 'SURVEY#test-tenant',
        sk: 'TEMPLATE#01HTEST',
      }

      const mockResult = new SurveyTemplateDataEntity({
        pk: 'SURVEY#test-tenant',
        sk: 'TEMPLATE#01HTEST',
        name: 'Test Survey',
        version: 1,
      } as any)

      mockService.findOne.mockResolvedValue(mockResult)

      const result = await controller.getData(detailDto)

      expect(service.findOne).toHaveBeenCalledWith(detailDto)
      expect(result).toEqual(mockResult)
    })

    it('should handle not found errors', async () => {
      const detailDto: DetailDto = {
        pk: 'SURVEY#test-tenant',
        sk: 'TEMPLATE#notfound',
      }
      const error = new Error('Survey template not found!')

      mockService.findOne.mockRejectedValue(error)

      await expect(controller.getData(detailDto)).rejects.toThrow(
        'Survey template not found!',
      )
    })
  })

  describe('updateData', () => {
    it('should update survey template successfully', async () => {
      const detailDto: DetailDto = {
        pk: 'SURVEY#test-tenant',
        sk: 'TEMPLATE#01HTEST',
      }
      const updateDto: SurveyTemplateUpdateDto = {
        name: 'Updated Survey',
      } as any

      const mockResult = new SurveyTemplateDataEntity({
        pk: 'SURVEY#test-tenant',
        sk: 'TEMPLATE#01HTEST',
        name: 'Updated Survey',
        version: 2,
      } as any)

      mockService.update.mockResolvedValue(mockResult)

      const result = await controller.updateData(
        detailDto,
        updateDto,
        mockInvokeContext,
      )

      expect(service.update).toHaveBeenCalledWith(detailDto, updateDto, {
        invokeContext: mockInvokeContext,
      })
      expect(result).toEqual(mockResult)
    })

    it('should handle update errors', async () => {
      const detailDto: DetailDto = {
        pk: 'SURVEY#test-tenant',
        sk: 'TEMPLATE#01HTEST',
      }
      const updateDto: SurveyTemplateUpdateDto = { name: 'Updated' } as any
      const error = new Error('Update failed')

      mockService.update.mockRejectedValue(error)

      await expect(
        controller.updateData(detailDto, updateDto, mockInvokeContext),
      ).rejects.toThrow('Update failed')
    })
  })

  describe('deleteData', () => {
    it('should delete survey template successfully', async () => {
      const detailDto: DetailDto = {
        pk: 'SURVEY#test-tenant',
        sk: 'TEMPLATE#01HTEST',
      }

      const mockResult = new SurveyTemplateDataEntity({
        pk: 'SURVEY#test-tenant',
        sk: 'TEMPLATE#01HTEST',
        isDeleted: true,
        version: 2,
      } as any)

      mockService.remove.mockResolvedValue(mockResult)

      const result = await controller.deleteData(detailDto, mockInvokeContext)

      expect(service.remove).toHaveBeenCalledWith(detailDto, {
        invokeContext: mockInvokeContext,
      })
      expect(result).toEqual(mockResult)
    })

    it('should handle deletion errors', async () => {
      const detailDto: DetailDto = {
        pk: 'SURVEY#test-tenant',
        sk: 'TEMPLATE#01HTEST',
      }
      const error = new Error('Deletion failed')

      mockService.remove.mockRejectedValue(error)

      await expect(
        controller.deleteData(detailDto, mockInvokeContext),
      ).rejects.toThrow('Deletion failed')
    })
  })
})
