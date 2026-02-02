import { Test, TestingModule } from '@nestjs/testing'
import {
  CommandService,
  DataService,
  getUserContext,
  IInvoke,
} from '@mbc-cqrs-serverless/core'

import { SurveyAnswerService } from './survey-answer.service'
import { SurveyAnswerCreateDto } from './dto/survey-answer-create.dto'
import { SurveyAnswerDataEntity } from './entity/survey-answer-data.entity'

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

describe('SurveyAnswerService', () => {
  let service: SurveyAnswerService
  let commandService: jest.Mocked<CommandService>

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

  beforeEach(async () => {
    // Default mock for getUserContext
    mockGetUserContext.mockReturnValue({
      tenantCode: 'test-tenant',
      userId: 'test-user',
    } as any)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SurveyAnswerService,
        {
          provide: CommandService,
          useValue: mockCommandService,
        },
        {
          provide: DataService,
          useValue: mockDataService,
        },
      ],
    }).compile()

    service = module.get<SurveyAnswerService>(SurveyAnswerService)
    commandService = module.get(CommandService) as jest.Mocked<CommandService>
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('create', () => {
    it('should create a survey answer successfully', async () => {
      const createDto: SurveyAnswerCreateDto = {
        attributes: {
          surveyId: 'survey123',
          answer: { q1: 'answer1', q2: 'answer2' },
          email: 'test@example.com',
        },
      } as any

      const mockCreatedItem = {
        pk: 'SURVEY#test-tenant',
        sk: 'SURVEY_ANSWER#survey123#01HTEST123456789ABCDEF',
        id: 'SURVEY#test-tenant#SURVEY_ANSWER#survey123#01HTEST123456789ABCDEF',
        name: '',
        version: 1,
        attributes: createDto.attributes,
      }

      mockCommandService.publishAsync.mockResolvedValue(mockCreatedItem as any)

      const result = await service.create(createDto, {
        invokeContext: mockInvokeContext,
      })

      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          pk: 'SURVEY#test-tenant',
          sk: 'SURVEY_ANSWER#survey123#01HTEST123456789ABCDEF',
          tenantCode: 'test-tenant',
          name: '',
          attributes: createDto.attributes,
        }),
        expect.objectContaining({
          invokeContext: mockInvokeContext,
        }),
      )
      expect(result).toBeInstanceOf(SurveyAnswerDataEntity)
    })

    it('should use tenant from user context', async () => {
      mockGetUserContext.mockReturnValue({
        tenantCode: 'custom-tenant',
        userId: 'test-user',
      } as any)

      const createDto: SurveyAnswerCreateDto = {
        attributes: {
          surveyId: 'survey456',
          answer: {},
        },
      } as any

      mockCommandService.publishAsync.mockResolvedValue({
        pk: 'SURVEY#custom-tenant',
        sk: 'SURVEY_ANSWER#survey456#01HTEST123456789ABCDEF',
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

    it('should generate correct sk with surveyId', async () => {
      const createDto: SurveyAnswerCreateDto = {
        attributes: {
          surveyId: 'my-survey-id',
          answer: { question: 'answer' },
        },
      } as any

      mockCommandService.publishAsync.mockResolvedValue({
        pk: 'SURVEY#test-tenant',
        sk: 'SURVEY_ANSWER#my-survey-id#01HTEST123456789ABCDEF',
      } as any)

      await service.create(createDto, { invokeContext: mockInvokeContext })

      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sk: 'SURVEY_ANSWER#my-survey-id#01HTEST123456789ABCDEF',
          code: 'SURVEY_ANSWER#my-survey-id#01HTEST123456789ABCDEF',
        }),
        expect.any(Object),
      )
    })

    it('should set empty name for answer', async () => {
      const createDto: SurveyAnswerCreateDto = {
        attributes: {
          surveyId: 'survey789',
          answer: {},
        },
      } as any

      mockCommandService.publishAsync.mockResolvedValue({
        name: '',
      } as any)

      await service.create(createDto, { invokeContext: mockInvokeContext })

      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '',
        }),
        expect.any(Object),
      )
    })

    it('should include all attributes in command', async () => {
      const createDto: SurveyAnswerCreateDto = {
        attributes: {
          surveyId: 'survey-abc',
          answer: { q1: 'a1', q2: 'a2', q3: 'a3' },
          email: 'user@domain.com',
          customField: 'custom value',
        },
      } as any

      mockCommandService.publishAsync.mockResolvedValue({
        attributes: createDto.attributes,
      } as any)

      await service.create(createDto, { invokeContext: mockInvokeContext })

      expect(commandService.publishAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: createDto.attributes,
        }),
        expect.any(Object),
      )
    })
  })
})
