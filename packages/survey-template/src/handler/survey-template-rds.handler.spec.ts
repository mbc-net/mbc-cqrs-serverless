import { Test, TestingModule } from '@nestjs/testing'
import { CommandModel } from '@mbc-cqrs-serverless/core'

import { SurveyTemplateDataSyncRdsHandler } from './survey-template-rds.handler'
import { PRISMA_SERVICE } from '../survey-template.module-definition'

describe('SurveyTemplateDataSyncRdsHandler', () => {
  let handler: SurveyTemplateDataSyncRdsHandler
  let prismaService: any

  const mockPrismaService = {
    surveyTemplate: {
      upsert: jest.fn(),
    },
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SurveyTemplateDataSyncRdsHandler,
        {
          provide: PRISMA_SERVICE,
          useValue: mockPrismaService,
        },
      ],
    }).compile()

    handler = module.get<SurveyTemplateDataSyncRdsHandler>(
      SurveyTemplateDataSyncRdsHandler,
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
    it('should upsert survey template when sk starts with TEMPLATE', async () => {
      const cmd = {
        id: 'survey-id-123',
        pk: 'SURVEY#test-tenant',
        sk: 'TEMPLATE#01HTEST@1',
        code: 'TEMPLATE#01HTEST',
        type: 'TEMPLATE',
        name: 'Test Survey',
        version: 1,
        seq: 1,
        tenantCode: 'test-tenant',
        attributes: {
          description: 'Test description',
          surveyTemplate: { questions: [] },
          additionalProperties: { key: 'value' },
        },
        isDeleted: false,
        createdAt: new Date('2024-01-01'),
        createdBy: 'user1',
        createdIp: '127.0.0.1',
        updatedAt: new Date('2024-01-02'),
        updatedBy: 'user2',
        updatedIp: '127.0.0.2',
      } as unknown as CommandModel

      mockPrismaService.surveyTemplate.upsert.mockResolvedValue({})

      await handler.up(cmd)

      expect(prismaService.surveyTemplate.upsert).toHaveBeenCalledWith({
        where: { id: 'survey-id-123' },
        update: {
          csk: 'TEMPLATE#01HTEST@1',
          name: 'Test Survey',
          version: 1,
          seq: 1,
          description: 'Test description',
          surveyTemplate: { questions: [] },
          additionalProperties: { key: 'value' },
          isDeleted: false,
          updatedAt: cmd.updatedAt,
          updatedBy: 'user2',
          updatedIp: '127.0.0.2',
        },
        create: {
          id: 'survey-id-123',
          cpk: 'SURVEY#test-tenant',
          csk: 'TEMPLATE#01HTEST@1',
          pk: 'SURVEY#test-tenant',
          sk: 'TEMPLATE#01HTEST',
          code: 'TEMPLATE#01HTEST',
          name: 'Test Survey',
          version: 1,
          tenantCode: 'test-tenant',
          seq: 1,
          description: 'Test description',
          surveyTemplate: { questions: [] },
          additionalProperties: { key: 'value' },
          createdAt: cmd.createdAt,
          createdBy: 'user1',
          createdIp: '127.0.0.1',
          updatedAt: cmd.updatedAt,
          updatedBy: 'user2',
          updatedIp: '127.0.0.2',
        },
      })
    })

    it('should skip non-TEMPLATE sk', async () => {
      const cmd = {
        id: 'survey-id-123',
        pk: 'SURVEY#test-tenant',
        sk: 'SURVEY_ANSWER#01HTEST',
        code: 'SURVEY_ANSWER#01HTEST',
        type: 'SURVEY_ANSWER',
        name: 'Test Answer',
      } as unknown as CommandModel

      await handler.up(cmd)

      expect(prismaService.surveyTemplate.upsert).not.toHaveBeenCalled()
    })

    it('should handle empty additionalProperties', async () => {
      const cmd = {
        id: 'survey-id-456',
        pk: 'SURVEY#test-tenant',
        sk: 'TEMPLATE#01HTEST2@1',
        code: 'TEMPLATE#01HTEST2',
        type: 'TEMPLATE',
        name: 'Survey without props',
        version: 1,
        seq: 1,
        tenantCode: 'test-tenant',
        attributes: {
          description: 'Description',
          surveyTemplate: {},
        },
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as CommandModel

      mockPrismaService.surveyTemplate.upsert.mockResolvedValue({})

      await handler.up(cmd)

      expect(prismaService.surveyTemplate.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            additionalProperties: {},
          }),
          create: expect.objectContaining({
            additionalProperties: {},
          }),
        }),
      )
    })

    it('should handle deleted items', async () => {
      const cmd = {
        id: 'survey-id-789',
        pk: 'SURVEY#test-tenant',
        sk: 'TEMPLATE#01HTEST3@2',
        code: 'TEMPLATE#01HTEST3',
        type: 'TEMPLATE',
        name: 'Deleted Survey',
        version: 2,
        seq: 2,
        tenantCode: 'test-tenant',
        attributes: {},
        isDeleted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as CommandModel

      mockPrismaService.surveyTemplate.upsert.mockResolvedValue({})

      await handler.up(cmd)

      expect(prismaService.surveyTemplate.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            isDeleted: true,
          }),
        }),
      )
    })

    it('should remove version from sk for storage', async () => {
      const cmd = {
        id: 'survey-id-abc',
        pk: 'SURVEY#test-tenant',
        sk: 'TEMPLATE#01HABC123@5',
        code: 'TEMPLATE#01HABC123',
        type: 'TEMPLATE',
        name: 'Versioned Survey',
        version: 5,
        seq: 5,
        tenantCode: 'test-tenant',
        attributes: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as CommandModel

      mockPrismaService.surveyTemplate.upsert.mockResolvedValue({})

      await handler.up(cmd)

      expect(prismaService.surveyTemplate.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            sk: 'TEMPLATE#01HABC123',
            code: 'TEMPLATE#01HABC123',
          }),
        }),
      )
    })

    it('should handle undefined isDeleted as false', async () => {
      const cmd = {
        id: 'survey-id-def',
        pk: 'SURVEY#test-tenant',
        sk: 'TEMPLATE#01HDEF@1',
        code: 'TEMPLATE#01HDEF',
        type: 'TEMPLATE',
        name: 'Survey without isDeleted',
        version: 1,
        seq: 1,
        tenantCode: 'test-tenant',
        attributes: {},
        isDeleted: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as CommandModel

      mockPrismaService.surveyTemplate.upsert.mockResolvedValue({})

      await handler.up(cmd)

      expect(prismaService.surveyTemplate.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            isDeleted: false,
          }),
        }),
      )
    })
  })

  describe('down', () => {
    it('should be defined and handle down operation', async () => {
      const cmd = {
        id: 'survey-id-123',
        pk: 'SURVEY#test-tenant',
        sk: 'TEMPLATE#01HTEST',
        code: 'TEMPLATE#01HTEST',
        type: 'TEMPLATE',
      } as unknown as CommandModel

      // down() currently just logs, so we just verify it doesn't throw
      await expect(handler.down(cmd)).resolves.not.toThrow()
    })
  })
})
