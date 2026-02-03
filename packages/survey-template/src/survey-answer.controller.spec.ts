import { Test, TestingModule } from '@nestjs/testing'
import { IInvoke } from '@mbc-cqrs-serverless/core'

import { SurveyAnswerController } from './survey-answer.controller'
import { SurveyAnswerService } from './survey-answer.service'
import { SurveyAnswerCreateDto } from './dto/survey-answer-create.dto'
import { SurveyAnswerDataEntity } from './entity/survey-answer-data.entity'

describe('SurveyAnswerController', () => {
  let controller: SurveyAnswerController
  let service: jest.Mocked<SurveyAnswerService>

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
    create: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SurveyAnswerController],
      providers: [
        {
          provide: SurveyAnswerService,
          useValue: mockService,
        },
      ],
    }).compile()

    controller = module.get<SurveyAnswerController>(SurveyAnswerController)
    service = module.get(SurveyAnswerService) as jest.Mocked<SurveyAnswerService>
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('create', () => {
    it('should create survey answer successfully', async () => {
      const createDto: SurveyAnswerCreateDto = {
        attributes: {
          surveyId: 'survey123',
          answer: { q1: 'answer1', q2: 'answer2' },
          email: 'test@example.com',
        },
      } as any

      const mockResult = new SurveyAnswerDataEntity({
        pk: 'SURVEY#test-tenant',
        sk: 'SURVEY_ANSWER#survey123#01HTEST',
        name: '',
        version: 1,
        attributes: createDto.attributes,
      } as any)

      mockService.create.mockResolvedValue(mockResult)

      const result = await controller.create(mockInvokeContext, createDto)

      expect(service.create).toHaveBeenCalledWith(createDto, {
        invokeContext: mockInvokeContext,
      })
      expect(result).toEqual(mockResult)
    })

    it('should handle creation errors', async () => {
      const createDto: SurveyAnswerCreateDto = {
        attributes: {
          surveyId: 'survey456',
          answer: {},
        },
      } as any
      const error = new Error('Creation failed')

      mockService.create.mockRejectedValue(error)

      await expect(
        controller.create(mockInvokeContext, createDto),
      ).rejects.toThrow('Creation failed')
    })

    it('should pass all attributes to service', async () => {
      const createDto: SurveyAnswerCreateDto = {
        attributes: {
          surveyId: 'survey789',
          answer: { q1: 'a1', q2: 'a2', q3: 'a3' },
          email: 'user@domain.com',
          customField: 'custom value',
        },
      } as any

      const mockResult = new SurveyAnswerDataEntity({
        pk: 'SURVEY#test-tenant',
        sk: 'SURVEY_ANSWER#survey789#01HTEST',
        attributes: createDto.attributes,
      } as any)

      mockService.create.mockResolvedValue(mockResult)

      await controller.create(mockInvokeContext, createDto)

      expect(service.create).toHaveBeenCalledWith(createDto, {
        invokeContext: mockInvokeContext,
      })
    })

    it('should return SurveyAnswerDataEntity', async () => {
      const createDto: SurveyAnswerCreateDto = {
        attributes: {
          surveyId: 'survey-abc',
          answer: {},
        },
      } as any

      const mockResult = new SurveyAnswerDataEntity({
        pk: 'SURVEY#test-tenant',
        sk: 'SURVEY_ANSWER#survey-abc#01HTEST',
        id: 'test-id',
        version: 1,
      } as any)

      mockService.create.mockResolvedValue(mockResult)

      const result = await controller.create(mockInvokeContext, createDto)

      expect(result).toBeInstanceOf(SurveyAnswerDataEntity)
    })
  })
})
