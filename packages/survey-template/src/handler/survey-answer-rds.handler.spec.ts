import { Test, TestingModule } from '@nestjs/testing'
import { CommandModel } from '@mbc-cqrs-serverless/core'

import { SurveyAnswerDataSyncRdsHandler } from './survey-answer-rds.handler'
import { PRISMA_SERVICE } from '../survey-template.module-definition'

describe('SurveyAnswerDataSyncRdsHandler', () => {
  let handler: SurveyAnswerDataSyncRdsHandler
  let prismaService: any

  const mockPrismaService = {
    surveyAnswer: {
      upsert: jest.fn(),
    },
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SurveyAnswerDataSyncRdsHandler,
        {
          provide: PRISMA_SERVICE,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    handler = module.get<SurveyAnswerDataSyncRdsHandler>(
      SurveyAnswerDataSyncRdsHandler,
    )
    prismaService = module.get(PRISMA_SERVICE)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(handler).toBeDefined()
  })

  describe('up', () => {
    it('should upsert survey answer when sk starts with SURVEY_ANSWER#', async () => {
      const cmd = {
        id: 'answer-id-123',
        pk: 'SURVEY#test-tenant',
        sk: 'SURVEY_ANSWER#survey123#01HTEST@1',
        code: 'SURVEY_ANSWER#survey123#01HTEST',
        type: 'SURVEY_ANSWER',
        name: '',
        version: 1,
        seq: 1,
        tenantCode: 'test-tenant',
        attributes: {
          surveyId: 'survey123',
          answer: { q1: 'answer1', q2: 'answer2' },
          email: 'test@example.com',
        },
        isDeleted: false,
        createdAt: new Date('2024-01-01'),
        createdBy: 'user1',
        createdIp: '127.0.0.1',
        updatedAt: new Date('2024-01-02'),
        updatedBy: 'user2',
        updatedIp: '127.0.0.2',
      } as unknown as CommandModel

      mockPrismaService.surveyAnswer.upsert.mockResolvedValue({})

      await handler.up(cmd)

      expect(prismaService.surveyAnswer.upsert).toHaveBeenCalledWith({
        where: { id: 'answer-id-123' },
        update: {
          csk: 'SURVEY_ANSWER#survey123#01HTEST@1',
          name: '',
          version: 1,
          seq: 1,
          isDeleted: false,
          updatedAt: cmd.updatedAt,
          updatedBy: 'user2',
          updatedIp: '127.0.0.2',
          attributes: { q1: 'answer1', q2: 'answer2' },
          surveyId: 'survey123',
        },
        create: {
          id: 'answer-id-123',
          cpk: 'SURVEY#test-tenant',
          csk: 'SURVEY_ANSWER#survey123#01HTEST@1',
          pk: 'SURVEY#test-tenant',
          sk: 'SURVEY_ANSWER#survey123#01HTEST',
          code: 'SURVEY_ANSWER#survey123#01HTEST',
          name: '',
          version: 1,
          tenantCode: 'test-tenant',
          seq: 1,
          createdAt: cmd.createdAt,
          createdBy: 'user1',
          createdIp: '127.0.0.1',
          updatedAt: cmd.updatedAt,
          updatedBy: 'user2',
          updatedIp: '127.0.0.2',
          attributes: { q1: 'answer1', q2: 'answer2' },
          surveyId: 'survey123',
          email: 'test@example.com',
        },
      })
    })

    it('should skip non-SURVEY_ANSWER sk', async () => {
      const cmd = {
        id: 'survey-id-123',
        pk: 'SURVEY#test-tenant',
        sk: 'TEMPLATE#01HTEST',
        code: 'TEMPLATE#01HTEST',
        type: 'TEMPLATE',
        name: 'Test Survey',
      } as unknown as CommandModel

      await handler.up(cmd)

      expect(prismaService.surveyAnswer.upsert).not.toHaveBeenCalled()
    })

    it('should skip sk that starts with SURVEY_ANSWER but not followed by #', async () => {
      const cmd = {
        id: 'answer-id-123',
        pk: 'SURVEY#test-tenant',
        sk: 'SURVEY_ANSWER_OTHER#01HTEST',
        code: 'SURVEY_ANSWER_OTHER#01HTEST',
        type: 'SURVEY_ANSWER_OTHER',
        name: '',
      } as unknown as CommandModel

      await handler.up(cmd)

      expect(prismaService.surveyAnswer.upsert).not.toHaveBeenCalled()
    })

    it('should handle deleted items', async () => {
      const cmd = {
        id: 'answer-id-456',
        pk: 'SURVEY#test-tenant',
        sk: 'SURVEY_ANSWER#survey456#01HTEST@2',
        code: 'SURVEY_ANSWER#survey456#01HTEST',
        type: 'SURVEY_ANSWER',
        name: '',
        version: 2,
        seq: 2,
        tenantCode: 'test-tenant',
        attributes: {
          surveyId: 'survey456',
          answer: {},
        },
        isDeleted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as CommandModel

      mockPrismaService.surveyAnswer.upsert.mockResolvedValue({})

      await handler.up(cmd)

      expect(prismaService.surveyAnswer.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            isDeleted: true,
          }),
        }),
      )
    })

    it('should remove version from sk for storage', async () => {
      const cmd = {
        id: 'answer-id-789',
        pk: 'SURVEY#test-tenant',
        sk: 'SURVEY_ANSWER#survey789#01HABC123@5',
        code: 'SURVEY_ANSWER#survey789#01HABC123',
        type: 'SURVEY_ANSWER',
        name: '',
        version: 5,
        seq: 5,
        tenantCode: 'test-tenant',
        attributes: {
          surveyId: 'survey789',
          answer: {},
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as CommandModel

      mockPrismaService.surveyAnswer.upsert.mockResolvedValue({})

      await handler.up(cmd)

      expect(prismaService.surveyAnswer.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            sk: 'SURVEY_ANSWER#survey789#01HABC123',
            code: 'SURVEY_ANSWER#survey789#01HABC123',
          }),
        }),
      )
    })

    it('should handle undefined isDeleted as false', async () => {
      const cmd = {
        id: 'answer-id-def',
        pk: 'SURVEY#test-tenant',
        sk: 'SURVEY_ANSWER#surveydef#01HDEF@1',
        code: 'SURVEY_ANSWER#surveydef#01HDEF',
        type: 'SURVEY_ANSWER',
        name: '',
        version: 1,
        seq: 1,
        tenantCode: 'test-tenant',
        attributes: {
          surveyId: 'surveydef',
          answer: {},
        },
        isDeleted: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as CommandModel

      mockPrismaService.surveyAnswer.upsert.mockResolvedValue({})

      await handler.up(cmd)

      expect(prismaService.surveyAnswer.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            isDeleted: false,
          }),
        }),
      )
    })

    it('should include email in create but not in update', async () => {
      const cmd = {
        id: 'answer-id-email',
        pk: 'SURVEY#test-tenant',
        sk: 'SURVEY_ANSWER#surveyemail#01HEMAIL@1',
        code: 'SURVEY_ANSWER#surveyemail#01HEMAIL',
        type: 'SURVEY_ANSWER',
        name: '',
        version: 1,
        seq: 1,
        tenantCode: 'test-tenant',
        attributes: {
          surveyId: 'surveyemail',
          answer: { q1: 'a1' },
          email: 'user@domain.com',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as CommandModel

      mockPrismaService.surveyAnswer.upsert.mockResolvedValue({})

      await handler.up(cmd)

      const upsertCall = mockPrismaService.surveyAnswer.upsert.mock.calls[0][0]

      // Create should have email
      expect(upsertCall.create.email).toBe('user@domain.com')

      // Update should NOT have email (email is only set on create)
      expect(upsertCall.update.email).toBeUndefined()
    })

    it('should store answer from attributes', async () => {
      const complexAnswer = {
        question1: { type: 'text', value: 'answer1' },
        question2: { type: 'choice', value: ['option1', 'option2'] },
        question3: { type: 'rating', value: 5 },
      }

      const cmd = {
        id: 'answer-id-complex',
        pk: 'SURVEY#test-tenant',
        sk: 'SURVEY_ANSWER#surveycomplex#01HCOMPLEX@1',
        code: 'SURVEY_ANSWER#surveycomplex#01HCOMPLEX',
        type: 'SURVEY_ANSWER',
        name: '',
        version: 1,
        seq: 1,
        tenantCode: 'test-tenant',
        attributes: {
          surveyId: 'surveycomplex',
          answer: complexAnswer,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as CommandModel

      mockPrismaService.surveyAnswer.upsert.mockResolvedValue({})

      await handler.up(cmd)

      expect(prismaService.surveyAnswer.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            attributes: complexAnswer,
          }),
          create: expect.objectContaining({
            attributes: complexAnswer,
          }),
        }),
      )
    })
  })

  describe('down', () => {
    it('should be defined and handle down operation', async () => {
      const cmd = {
        id: 'answer-id-123',
        pk: 'SURVEY#test-tenant',
        sk: 'SURVEY_ANSWER#survey123#01HTEST',
        code: 'SURVEY_ANSWER#survey123#01HTEST',
        type: 'SURVEY_ANSWER',
      } as unknown as CommandModel

      // down() currently just logs, so we just verify it doesn't throw
      await expect(handler.down(cmd)).resolves.not.toThrow()
    })
  })
})
