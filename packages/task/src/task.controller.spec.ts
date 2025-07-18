import { createMock } from '@golevelup/ts-jest'
import { Test, TestingModule } from '@nestjs/testing'
import { IInvoke } from '@mbc-cqrs-serverless/core'

import { TaskController } from './task.controller'
import { TaskService } from './task.service'
import { CreateTaskDto } from './dto'

describe('TaskController', () => {
  let controller: TaskController
  let service: TaskService

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
      controllers: [TaskController],
      providers: [TaskService],
    })
      .useMocker(createMock)
      .compile()

    controller = module.get<TaskController>(TaskController)
    service = module.get<TaskService>(TaskService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('createTask', () => {
    it('should create a task successfully', async () => {
      const createTaskDto: CreateTaskDto = {
        tenantCode: 'test-tenant',
        taskType: 'TEST_TYPE',
        name: 'Test Task',
        input: { key: 'value' },
      }
      const expectedResult = {
        pk: 'test-tenant#task',
        sk: 'task-id',
        tenantCode: 'test-tenant',
        taskType: 'TEST_TYPE',
        name: 'Test Task',
        input: { key: 'value' },
      }

      jest.spyOn(service, 'createTask').mockResolvedValue(expectedResult as any)

      const result = await controller.createTask(mockInvokeContext, createTaskDto)

      expect(service.createTask).toHaveBeenCalledWith(createTaskDto, {
        invokeContext: mockInvokeContext,
      })
      expect(result).toEqual(expectedResult)
    })

    it('should handle service errors', async () => {
      const createTaskDto: CreateTaskDto = {
        tenantCode: 'test-tenant',
        taskType: 'TEST_TYPE',
        name: 'Test Task',
        input: { key: 'value' },
      }
      const error = new Error('Service error')

      jest.spyOn(service, 'createTask').mockRejectedValue(error)

      await expect(
        controller.createTask(mockInvokeContext, createTaskDto),
      ).rejects.toThrow('Service error')
    })
  })
})
