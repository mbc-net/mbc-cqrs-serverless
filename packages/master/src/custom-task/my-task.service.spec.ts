import { Test, TestingModule } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'
import { BadRequestException } from '@nestjs/common'

import { MyTaskService } from './my-task.service'
import { TaskService, TaskEntity } from '@mbc-cqrs-serverless/task'
import { DetailKey, IInvoke } from '@mbc-cqrs-serverless/core'

describe('MyTaskService', () => {
  let service: MyTaskService
  let taskService: jest.Mocked<TaskService>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MyTaskService,
        {
          provide: TaskService,
          useValue: createMock<TaskService>(),
        },
      ],
    }).compile()

    service = module.get<MyTaskService>(MyTaskService)
    taskService = module.get(TaskService)

    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('getSfnTaskParentBySettingCode', () => {
    const mockInvokeContext = {
      event: {
        headers: {},
        requestContext: {
          authorizer: {
            jwt: { claims: { sub: 'u1', 'custom:tenant': 'test-tenant' } },
          },
        },
      },
    } as unknown as IInvoke

    it('should return parent tasks for valid setting code', async () => {
      const masterSettingCode = 'TEST_SETTING'
      const mockTasks: TaskEntity[] = [
        {
          pk: 'test-tenant',
          sk: 'MASTER_COPY_TEST_SETTING#PARENT',
          type: 'SFN_TASK',
          version: 1,
          createdAt: new Date('2023-01-01T00:00:00Z'),
          updatedAt: new Date('2023-01-01T00:00:00Z'),
        } as TaskEntity,
        {
          pk: 'test-tenant',
          sk: 'MASTER_COPY_TEST_SETTING#PARENT#CHILD',
          type: 'SFN_TASK',
          version: 1,
          createdAt: new Date('2023-01-01T00:00:00Z'),
          updatedAt: new Date('2023-01-01T00:00:00Z'),
        } as TaskEntity,
      ]

      taskService.listItemsByPk.mockResolvedValue({
        items: mockTasks,
        lastSk: undefined,
      })

      const result = await service.getSfnTaskParentBySettingCode(
        masterSettingCode,
        mockInvokeContext,
      )

      expect(result).toHaveLength(1)
      expect(result[0].sk).toBe('MASTER_COPY_TEST_SETTING#PARENT')
    })

    it('should throw BadRequestException when masterSettingCode is empty', async () => {
      await expect(
        service.getSfnTaskParentBySettingCode('', mockInvokeContext),
      ).rejects.toThrow(BadRequestException)

      await expect(
        service.getSfnTaskParentBySettingCode('', mockInvokeContext),
      ).rejects.toThrow('Must provide master setting code')
    })

    it('lists the claim tenant, not the x-tenant-code header', async () => {
      const ctx = {
        event: {
          headers: { 'x-tenant-code': 'tb' },
          requestContext: {
            authorizer: {
              jwt: { claims: { sub: 'u1', 'custom:tenant': 'ta' } },
            },
          },
        },
      } as unknown as IInvoke
      taskService.listItemsByPk.mockResolvedValue({ items: [] } as any)

      await service.getSfnTaskParentBySettingCode('S1', ctx)

      expect(taskService.listItemsByPk).toHaveBeenCalledWith(
        'ta',
        'SFN_TASK',
        expect.anything(),
      )
    })

    it('should throw BadRequestException when masterSettingCode is null', async () => {
      await expect(
        service.getSfnTaskParentBySettingCode(null as any, mockInvokeContext),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('getSfnChildTask', () => {
    it('should return child tasks for given key', async () => {
      const key: DetailKey = {
        pk: 'test-tenant',
        sk: 'MASTER_COPY_TEST_SETTING#PARENT',
      }

      const mockChildTasks: TaskEntity[] = [
        {
          pk: 'test-tenant',
          sk: 'MASTER_COPY_TEST_SETTING#PARENT#CHILD1',
          type: 'SFN_TASK',
          version: 1,
          createdAt: new Date('2023-01-01T00:00:00Z'),
          updatedAt: new Date('2023-01-01T00:00:00Z'),
        } as TaskEntity,
      ]

      taskService.getAllSubTask.mockResolvedValue(mockChildTasks)

      const result = await service.getSfnChildTask(key)

      expect(taskService.getAllSubTask).toHaveBeenCalledWith(key)
      expect(result).toBe(mockChildTasks)
    })

    it('should handle empty child tasks', async () => {
      const key: DetailKey = {
        pk: 'test-tenant',
        sk: 'MASTER_COPY_TEST_SETTING#PARENT',
      }

      taskService.getAllSubTask.mockResolvedValue([])

      const result = await service.getSfnChildTask(key)

      expect(result).toEqual([])
    })
  })
})
