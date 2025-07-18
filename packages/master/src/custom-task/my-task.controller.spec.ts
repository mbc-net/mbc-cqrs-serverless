import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException } from '@nestjs/common'
import { DetailDto, IInvoke } from '@mbc-cqrs-serverless/core'
import { TaskEntity, TaskStatusEnum } from '@mbc-cqrs-serverless/task'

import { MyTaskController } from './my-task.controller'
import { MyTaskService } from './my-task.service'

describe('MyTaskController', () => {
  let controller: MyTaskController
  let service: MyTaskService

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
    const mockMyTaskService = {
      getSfnTaskParentBySettingCode: jest.fn(),
      getSfnChildTask: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MyTaskController],
      providers: [
        {
          provide: MyTaskService,
          useValue: mockMyTaskService,
        },
      ],
    }).compile()

    controller = module.get<MyTaskController>(MyTaskController)
    service = module.get<MyTaskService>(MyTaskService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('getSfnTaskParentBySettingCode', () => {
    it('should get SFN task parent by setting code successfully', async () => {
      const masterSettingCode = 'TEST_SETTING'
      const expectedResult: TaskEntity[] = [
        new TaskEntity({
          pk: 'TASK#test-tenant',
          sk: 'SFN_TASK#MASTER_COPY_TEST_SETTING',
          id: 'SFN_TASK#MASTER_COPY_TEST_SETTING',
          code: 'SFN_TASK#MASTER_COPY_TEST_SETTING',
          name: 'Test Task',
          tenantCode: 'test-tenant',
          type: 'SFN_TASK',
          status: TaskStatusEnum.QUEUED,
          input: { masterSettingCode: 'TEST_SETTING' },
          version: 1,
        }),
      ]

      jest
        .spyOn(service, 'getSfnTaskParentBySettingCode')
        .mockResolvedValue(expectedResult)

      const result = await controller.getSfnTaskParentBySettingCode(
        mockInvokeContext,
        masterSettingCode,
      )

      expect(service.getSfnTaskParentBySettingCode).toHaveBeenCalledWith(
        masterSettingCode,
        mockInvokeContext,
      )
      expect(result).toEqual(expectedResult)
    })

    it('should handle missing master setting code', async () => {
      const masterSettingCode = ''
      const error = new BadRequestException('Must provide master setting code')

      jest
        .spyOn(service, 'getSfnTaskParentBySettingCode')
        .mockRejectedValue(error)

      await expect(
        controller.getSfnTaskParentBySettingCode(mockInvokeContext, masterSettingCode),
      ).rejects.toThrow('Must provide master setting code')
    })

    it('should handle service errors', async () => {
      const masterSettingCode = 'TEST_SETTING'
      const error = new Error('Service error')

      jest
        .spyOn(service, 'getSfnTaskParentBySettingCode')
        .mockRejectedValue(error)

      await expect(
        controller.getSfnTaskParentBySettingCode(mockInvokeContext, masterSettingCode),
      ).rejects.toThrow('Service error')
    })
  })

  describe('getSfnChildTask', () => {
    it('should get SFN child task successfully', async () => {
      const key: DetailDto = { pk: 'TASK#test-tenant', sk: 'SFN_TASK#PARENT' }
      const expectedResult: TaskEntity[] = [
        new TaskEntity({
          pk: 'TASK#test-tenant',
          sk: 'SFN_TASK#PARENT#CHILD1',
          id: 'SFN_TASK#PARENT#CHILD1',
          code: 'SFN_TASK#PARENT#CHILD1',
          name: 'Child Task 1',
          tenantCode: 'test-tenant',
          type: 'SFN_TASK',
          status: TaskStatusEnum.COMPLETED,
          input: { parentTaskId: 'parent-task-123' },
          version: 1,
        }),
        new TaskEntity({
          pk: 'TASK#test-tenant',
          sk: 'SFN_TASK#PARENT#CHILD2',
          id: 'SFN_TASK#PARENT#CHILD2',
          code: 'SFN_TASK#PARENT#CHILD2',
          name: 'Child Task 2',
          tenantCode: 'test-tenant',
          type: 'SFN_TASK',
          status: TaskStatusEnum.QUEUED,
          input: { parentTaskId: 'parent-task-123' },
          version: 1,
        }),
      ]

      jest.spyOn(service, 'getSfnChildTask').mockResolvedValue(expectedResult)

      const result = await controller.getSfnChildTask(key)

      expect(service.getSfnChildTask).toHaveBeenCalledWith(key)
      expect(result).toEqual(expectedResult)
    })

    it('should handle empty child task results', async () => {
      const key: DetailDto = { pk: 'TASK#test-tenant', sk: 'SFN_TASK#PARENT' }
      const expectedResult: TaskEntity[] = []

      jest.spyOn(service, 'getSfnChildTask').mockResolvedValue(expectedResult)

      const result = await controller.getSfnChildTask(key)

      expect(service.getSfnChildTask).toHaveBeenCalledWith(key)
      expect(result).toEqual(expectedResult)
    })

    it('should handle service errors', async () => {
      const key: DetailDto = { pk: 'TASK#test-tenant', sk: 'SFN_TASK#PARENT' }
      const error = new Error('Child task retrieval failed')

      jest.spyOn(service, 'getSfnChildTask').mockRejectedValue(error)

      await expect(controller.getSfnChildTask(key)).rejects.toThrow(
        'Child task retrieval failed',
      )
    })
  })
})
