import { BadRequestException, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import {
  CommandService,
  DataService,
  getUserContext,
  IInvoke,
} from '@mbc-cqrs-serverless/core'

import { SurveyTemplateService } from './survey-template.service'
import { SurveyTemplateCreateDto } from './dto/survey-template-create.dto'
import { SurveyTemplateUpdateDto } from './dto/survey-template-update.dto'
import { SurveyTemplateDataEntity } from './entity/survey-template-data.entity'
import { PRISMA_SERVICE } from './survey-template.module-definition'

// Mock getUserContext
jest.mock('@mbc-cqrs-serverless/core', () => {
  const original = jest.requireActual('@mbc-cqrs-serverless/core')
  return {
    ...original,
    getUserContext: jest.fn(),
    generateId: jest.fn().mockImplementation((pk, sk) => `${pk}#${sk}`),
  }
})

// Mock ulid
jest.mock('ulid', () => ({
  ulid: jest.fn().mockReturnValue('01HTEST123456789ABCDEF'),
}))

const mockGetUserContext = getUserContext as jest.MockedFunction<
  typeof getUserContext
>

describe('SurveyTemplateService', () => {
  let service: SurveyTemplateService
  let commandService: jest.Mocked<CommandService>
  let dataService: jest.Mocked<DataService>
  let prismaService: any

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

  const mockCommandService = {
    publishAsync: jest.fn(),
    publishPartialUpdateAsync: jest.fn(),
    tableName: 'test-table',
  }

  const mockDataService = {
    getItem: jest.fn(),
    getItemVersion: jest.fn(),
  }

  const mockPrismaService = {
    surveyTemplate: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  }

  beforeEach(async () => {
    // Default mock for getUserContext
    mockGetUserContext.mockReturnValue({
      tenantCode: 'test-tenant',
      userId: 'test-user',
    } as any)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SurveyTemplateService,
        {
          provide: CommandService,
          useValue: mockCommandService,
        },
        {
          provide: DataService,
          useValue: mockDataService,
        },
        {
          provide: PRISMA_SERVICE,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    service = module.get<SurveyTemplateService>(SurveyTemplateService)
    commandService = module.get(CommandService) as jest.Mocked<CommandService>
    dataService = module.get(DataService) as jest.Mocked<DataService>
    prismaService = module.get(PRISMA_SERVICE)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('searchData', () => {
    it('should search data with default parameters', async () => {
      const mockItems = [
        {
          id: 'survey1',
          pk: 'SURVEY#test-tenant',
          sk: 'TEMPLATE#01HTEST123',
          name: 'Test Survey',
          description: 'Test description',
          surveyTemplate: { questions: [] },
        },
      ]

      mockPrismaService.surveyTemplate.count.mockResolvedValue(1)
      mockPrismaService.surveyTemplate.findMany.mockResolvedValue(mockItems)

      const result = await service.searchData('test-tenant', {})

      expect(prismaService.surveyTemplate.count).toHaveBeenCalledWith({
        where: { isDeleted: false, tenantCode: 'test-tenant' },
      })
      expect(prismaService.surveyTemplate.findMany).toHaveBeenCalledWith({
        where: { isDeleted: false, tenantCode: 'test-tenant' },
        take: 10,
        skip: 0,
        orderBy: [{ createdAt: 'desc' }],
      })
      expect(result.total).toBe(1)
      expect(result.items).toHaveLength(1)
    })

    it('should search data with keyword filter', async () => {
      const searchDto = { keyword: 'test' }
      mockPrismaService.surveyTemplate.count.mockResolvedValue(0)
      mockPrismaService.surveyTemplate.findMany.mockResolvedValue([])

      await service.searchData('test-tenant', searchDto)

      expect(prismaService.surveyTemplate.count).toHaveBeenCalledWith({
        where: {
          isDeleted: false,
          tenantCode: 'test-tenant',
          OR: [
            { name: { contains: 'test', mode: 'insensitive' } },
            { description: { contains: 'test', mode: 'insensitive' } },
          ],
        },
      })
    })

    it('should search data with pagination', async () => {
      const searchDto = { pageSize: 5, page: 2 }
      mockPrismaService.surveyTemplate.count.mockResolvedValue(10)
      mockPrismaService.surveyTemplate.findMany.mockResolvedValue([])

      await service.searchData('test-tenant', searchDto)

      expect(prismaService.surveyTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          skip: 5, // (page - 1) * pageSize = (2 - 1) * 5 = 5
        }),
      )
    })

    it('should search data with id filter', async () => {
      const searchDto = { id: 'survey1' }
      mockPrismaService.surveyTemplate.count.mockResolvedValue(1)
      mockPrismaService.surveyTemplate.findMany.mockResolvedValue([])

      await service.searchData('test-tenant', searchDto)

      expect(prismaService.surveyTemplate.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ id: 'survey1' }),
      })
    })

    it('should search data with pk filter', async () => {
      const searchDto = { pk: 'SURVEY#test-tenant' }
      mockPrismaService.surveyTemplate.count.mockResolvedValue(1)
      mockPrismaService.surveyTemplate.findMany.mockResolvedValue([])

      await service.searchData('test-tenant', searchDto)

      expect(prismaService.surveyTemplate.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ pk: 'SURVEY#test-tenant' }),
      })
    })

    it('should search data with sk filter', async () => {
      const searchDto = { sk: 'TEMPLATE#01HTEST' }
      mockPrismaService.surveyTemplate.count.mockResolvedValue(1)
      mockPrismaService.surveyTemplate.findMany.mockResolvedValue([])

      await service.searchData('test-tenant', searchDto)

      expect(prismaService.surveyTemplate.count).toHaveBeenCalledWith({
        where: expect.objectContaining({ sk: 'TEMPLATE#01HTEST' }),
      })
    })

    it('should apply custom orderBys', async () => {
      const searchDto = { orderBys: ['name', '-updatedAt'] }
      mockPrismaService.surveyTemplate.count.mockResolvedValue(0)
      mockPrismaService.surveyTemplate.findMany.mockResolvedValue([])

      await service.searchData('test-tenant', searchDto)

      expect(prismaService.surveyTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ name: 'asc' }, { updatedAt: 'desc' }],
        }),
      )
    })

    it('should trim keyword whitespace', async () => {
      const searchDto = { keyword: '  test  ' }
      mockPrismaService.surveyTemplate.count.mockResolvedValue(0)
      mockPrismaService.surveyTemplate.findMany.mockResolvedValue([])

      await service.searchData('test-tenant', searchDto)

      expect(prismaService.surveyTemplate.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          OR: [
            { name: { contains: 'test', mode: 'insensitive' } },
            { description: { contains: 'test', mode: 'insensitive' } },
          ],
        }),
      })
    })
  })

  describe('create', () => {
    it('should create a survey template successfully', async () => {
      const createDto: SurveyTemplateCreateDto = {
        name: 'New Survey',
        attributes: {
          surveyTemplate: { questions: [{ id: 1, text: 'Question 1' }] },
        },
      } as any

      const mockCreatedItem = {
        pk: 'SURVEY#test-tenant',
        sk: 'TEMPLATE#01HTEST123456789ABCDEF',
        id: 'SURVEY#test-tenant#TEMPLATE#01HTEST123456789ABCDEF',
        name: 'New Survey',
        version: 1,
      }

      mockCommandService.publishAsync.mockResolvedValue(mockCreatedItem as any)

      const result = await service.create(createDto, {
        invokeContext: mockInvokeContext,
      })

      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          pk: 'SURVEY#test-tenant',
          sk: 'TEMPLATE#01HTEST123456789ABCDEF',
          tenantCode: 'test-tenant',
          name: 'New Survey',
          type: 'TEMPLATE',
        }),
        expect.objectContaining({
          invokeContext: mockInvokeContext,
        }),
      )
      expect(result).toBeInstanceOf(SurveyTemplateDataEntity)
    })

    it('should use tenant from user context', async () => {
      mockGetUserContext.mockReturnValue({
        tenantCode: 'custom-tenant',
        userId: 'test-user',
      } as any)

      const createDto: SurveyTemplateCreateDto = {
        name: 'New Survey',
        attributes: { surveyTemplate: {} },
      } as any

      mockCommandService.publishAsync.mockResolvedValue({
        pk: 'SURVEY#custom-tenant',
      } as any)

      await service.create(createDto, { invokeContext: mockInvokeContext })

      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          pk: 'SURVEY#custom-tenant',
          tenantCode: 'custom-tenant',
        }),
        expect.any(Object),
      )
    })
  })

  describe('findOne', () => {
    it('should return survey template when found', async () => {
      const detailDto = { pk: 'SURVEY#test-tenant', sk: 'TEMPLATE#01HTEST' }
      const mockItem = {
        pk: 'SURVEY#test-tenant',
        sk: 'TEMPLATE#01HTEST',
        name: 'Test Survey',
        version: 1,
      }

      mockDataService.getItem.mockResolvedValue(mockItem as any)

      const result = await service.findOne(detailDto)

      expect(dataService.getItem).toHaveBeenCalledWith(detailDto)
      expect(result).toBeInstanceOf(SurveyTemplateDataEntity)
      expect(result.name).toBe('Test Survey')
    })

    it('should throw NotFoundException when not found', async () => {
      const detailDto = { pk: 'SURVEY#test-tenant', sk: 'TEMPLATE#notfound' }

      mockDataService.getItem.mockResolvedValue(null)

      await expect(service.findOne(detailDto)).rejects.toThrow(NotFoundException)
      await expect(service.findOne(detailDto)).rejects.toThrow(
        'Survey template not found!',
      )
    })
  })

  describe('update', () => {
    it('should update survey template successfully', async () => {
      const detailDto = { pk: 'SURVEY#test-tenant', sk: 'TEMPLATE#01HTEST' }
      const updateDto: SurveyTemplateUpdateDto = {
        name: 'Updated Survey',
        attributes: { description: 'Updated description' },
      } as any

      const existingItem = {
        pk: 'SURVEY#test-tenant',
        sk: 'TEMPLATE#01HTEST',
        name: 'Original Survey',
        version: 1,
        attributes: { surveyTemplate: {} },
      }

      const updatedItem = {
        ...existingItem,
        name: 'Updated Survey',
        version: 2,
      }

      mockDataService.getItem.mockResolvedValue(existingItem as any)
      mockCommandService.publishPartialUpdateAsync.mockResolvedValue(
        updatedItem as any,
      )

      const result = await service.update(detailDto, updateDto, {
        invokeContext: mockInvokeContext,
      })

      expect(dataService.getItem).toHaveBeenCalledWith(detailDto)
      expect(commandService.publishPartialUpdateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          pk: 'SURVEY#test-tenant',
          sk: 'TEMPLATE#01HTEST',
          name: 'Updated Survey',
          version: 1,
        }),
        expect.any(Object),
      )
      expect(result).toBeInstanceOf(SurveyTemplateDataEntity)
    })

    it('should throw BadRequestException for tenant mismatch', async () => {
      mockGetUserContext.mockReturnValue({
        tenantCode: 'other-tenant',
        userId: 'test-user',
      } as any)

      const detailDto = { pk: 'SURVEY#test-tenant', sk: 'TEMPLATE#01HTEST' }
      const updateDto: SurveyTemplateUpdateDto = { name: 'Updated' } as any

      await expect(
        service.update(detailDto, updateDto, {
          invokeContext: mockInvokeContext,
        }),
      ).rejects.toThrow(BadRequestException)
      await expect(
        service.update(detailDto, updateDto, {
          invokeContext: mockInvokeContext,
        }),
      ).rejects.toThrow('Invalid tenant code')
    })

    it('should throw NotFoundException when item not found', async () => {
      const detailDto = { pk: 'SURVEY#test-tenant', sk: 'TEMPLATE#notfound' }
      const updateDto: SurveyTemplateUpdateDto = { name: 'Updated' } as any

      mockDataService.getItem.mockResolvedValue(null)

      await expect(
        service.update(detailDto, updateDto, {
          invokeContext: mockInvokeContext,
        }),
      ).rejects.toThrow(NotFoundException)
    })

    it('should preserve existing attributes when updating', async () => {
      const detailDto = { pk: 'SURVEY#test-tenant', sk: 'TEMPLATE#01HTEST' }
      const updateDto: SurveyTemplateUpdateDto = {
        attributes: { newField: 'value' },
      } as any

      const existingItem = {
        pk: 'SURVEY#test-tenant',
        sk: 'TEMPLATE#01HTEST',
        name: 'Original Survey',
        version: 1,
        attributes: { existingField: 'existing' },
      }

      mockDataService.getItem.mockResolvedValue(existingItem as any)
      mockCommandService.publishPartialUpdateAsync.mockResolvedValue(
        existingItem as any,
      )

      await service.update(detailDto, updateDto, {
        invokeContext: mockInvokeContext,
      })

      expect(commandService.publishPartialUpdateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: {
            existingField: 'existing',
            newField: 'value',
          },
        }),
        expect.any(Object),
      )
    })

    it('should update isDeleted flag', async () => {
      const detailDto = { pk: 'SURVEY#test-tenant', sk: 'TEMPLATE#01HTEST' }
      const updateDto: SurveyTemplateUpdateDto = { isDeleted: true } as any

      const existingItem = {
        pk: 'SURVEY#test-tenant',
        sk: 'TEMPLATE#01HTEST',
        name: 'Survey',
        version: 1,
        isDeleted: false,
        attributes: {},
      }

      mockDataService.getItem.mockResolvedValue(existingItem as any)
      mockCommandService.publishPartialUpdateAsync.mockResolvedValue({
        ...existingItem,
        isDeleted: true,
      } as any)

      await service.update(detailDto, updateDto, {
        invokeContext: mockInvokeContext,
      })

      expect(commandService.publishPartialUpdateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          isDeleted: true,
        }),
        expect.any(Object),
      )
    })
  })

  describe('remove', () => {
    it('should soft delete survey template', async () => {
      const detailDto = { pk: 'SURVEY#test-tenant', sk: 'TEMPLATE#01HTEST' }

      const existingItem = {
        pk: 'SURVEY#test-tenant',
        sk: 'TEMPLATE#01HTEST',
        name: 'Survey',
        version: 1,
        isDeleted: false,
      }

      const deletedItem = {
        ...existingItem,
        isDeleted: true,
        version: 2,
      }

      mockDataService.getItem.mockResolvedValue(existingItem as any)
      mockCommandService.publishPartialUpdateAsync.mockResolvedValue(
        deletedItem as any,
      )

      const result = await service.remove(detailDto, {
        invokeContext: mockInvokeContext,
      })

      expect(commandService.publishPartialUpdateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          pk: 'SURVEY#test-tenant',
          sk: 'TEMPLATE#01HTEST',
          isDeleted: true,
        }),
        expect.any(Object),
      )
      expect(result).toBeInstanceOf(SurveyTemplateDataEntity)
    })

    it('should throw BadRequestException for tenant mismatch', async () => {
      mockGetUserContext.mockReturnValue({
        tenantCode: 'other-tenant',
        userId: 'test-user',
      } as any)

      const detailDto = { pk: 'SURVEY#test-tenant', sk: 'TEMPLATE#01HTEST' }

      await expect(
        service.remove(detailDto, { invokeContext: mockInvokeContext }),
      ).rejects.toThrow(BadRequestException)
    })

    it('should throw NotFoundException when item not found', async () => {
      const detailDto = { pk: 'SURVEY#test-tenant', sk: 'TEMPLATE#notfound' }

      mockDataService.getItem.mockResolvedValue(null)

      await expect(
        service.remove(detailDto, { invokeContext: mockInvokeContext }),
      ).rejects.toThrow(NotFoundException)
    })
  })
})
