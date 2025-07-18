import { createMock } from '@golevelup/ts-jest'
import { Test, TestingModule } from '@nestjs/testing'
import { DetailDto, IInvoke } from '@mbc-cqrs-serverless/core'

import { SequencesController } from './sequences.controller'
import { SequencesService } from './sequences.service'
import {
  GenerateFormattedSequenceDto,
  GenerateFormattedSequenceWithProvidedSettingDto,
} from './dto'

describe('SequencesController', () => {
  let controller: SequencesController
  let service: SequencesService

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
    const mockDynamoDbService = {
      getTableName: jest.fn().mockReturnValue('test-sequences-table'),
      getItem: jest.fn(),
      updateItem: jest.fn(),
    }

    const mockSequenceMasterDataProvider = {
      getData: jest.fn(),
    }

    const mockSequencesService = {
      getCurrentSequence: jest.fn(),
      generateSequenceItem: jest.fn(),
      generateSequenceItemWithProvideSetting: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SequencesController],
      providers: [
        {
          provide: SequencesService,
          useValue: mockSequencesService,
        },
      ],
    }).compile()

    controller = module.get<SequencesController>(SequencesController)
    service = module.get<SequencesService>(SequencesService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('getSequence', () => {
    it('should get current sequence successfully', async () => {
      const detailDto: DetailDto = { pk: 'test-pk', sk: 'test-sk' }
      const expectedResult = {
        pk: 'test-pk',
        sk: 'test-sk',
        sequence: 1,
        version: 1,
      }

      jest
        .spyOn(service, 'getCurrentSequence')
        .mockResolvedValue(expectedResult as any)

      const result = await controller.getSequence(detailDto)

      expect(service.getCurrentSequence).toHaveBeenCalledWith(detailDto)
      expect(result).toEqual(expectedResult)
    })

    it('should handle service errors', async () => {
      const detailDto: DetailDto = { pk: 'test-pk', sk: 'test-sk' }
      const error = new Error('Sequence not found')

      jest.spyOn(service, 'getCurrentSequence').mockRejectedValue(error)

      await expect(controller.getSequence(detailDto)).rejects.toThrow(
        'Sequence not found',
      )
    })
  })

  describe('genSequence', () => {
    it('should generate sequence successfully', async () => {
      const generateDto: GenerateFormattedSequenceDto = {
        tenantCode: 'test-tenant',
        typeCode: 'TEST_TYPE',
      }
      const expectedResult = {
        pk: 'test-tenant#sequence',
        sk: 'TEST_SETTING',
        sequence: 1,
        version: 1,
      }

      jest
        .spyOn(service, 'generateSequenceItem')
        .mockResolvedValue(expectedResult as any)

      const result = await controller.genSequence(mockInvokeContext, generateDto)

      expect(service.generateSequenceItem).toHaveBeenCalledWith(generateDto, {
        invokeContext: mockInvokeContext,
      })
      expect(result).toEqual(expectedResult)
    })

    it('should handle generation errors', async () => {
      const generateDto: GenerateFormattedSequenceDto = {
        tenantCode: 'test-tenant',
        typeCode: 'TEST_TYPE',
      }
      const error = new Error('Generation failed')

      jest.spyOn(service, 'generateSequenceItem').mockRejectedValue(error)

      await expect(
        controller.genSequence(mockInvokeContext, generateDto),
      ).rejects.toThrow('Generation failed')
    })
  })

  describe('genSequenceWithProvidedSetting', () => {
    it('should generate sequence with provided setting successfully', async () => {
      const generateDto: GenerateFormattedSequenceWithProvidedSettingDto = {
        tenantCode: 'test-tenant',
        typeCode: 'CUSTOM_TYPE',
        format: 'CUSTOM-{sequence}',
      }
      const expectedResult = {
        pk: 'test-tenant#sequence',
        sk: 'CUSTOM_SETTING',
        sequence: 1,
        version: 1,
      }

      jest
        .spyOn(service, 'generateSequenceItemWithProvideSetting')
        .mockResolvedValue(expectedResult as any)

      const result = await controller.genSequenceWithProvidedSetting(
        mockInvokeContext,
        generateDto,
      )

      expect(
        service.generateSequenceItemWithProvideSetting,
      ).toHaveBeenCalledWith(generateDto, {
        invokeContext: mockInvokeContext,
      })
      expect(result).toEqual(expectedResult)
    })

    it('should handle generation errors with provided setting', async () => {
      const generateDto: GenerateFormattedSequenceWithProvidedSettingDto = {
        tenantCode: 'test-tenant',
        typeCode: 'CUSTOM_TYPE',
        format: 'CUSTOM-{sequence}',
      }
      const error = new Error('Generation with setting failed')

      jest
        .spyOn(service, 'generateSequenceItemWithProvideSetting')
        .mockRejectedValue(error)

      await expect(
        controller.genSequenceWithProvidedSetting(
          mockInvokeContext,
          generateDto,
        ),
      ).rejects.toThrow('Generation with setting failed')
    })
  })
})
