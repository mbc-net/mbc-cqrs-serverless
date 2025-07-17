import { Test, TestingModule } from '@nestjs/testing'
import { createMock } from '@golevelup/ts-jest'
import { BadRequestException } from '@nestjs/common'

import { MyTaskService } from './my-task.service'
import { TaskService, TaskEntity } from '@mbc-cqrs-serverless/task'
import {
  DetailKey,
  IInvoke,
} from '@mbc-cqrs-serverless/core'

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
    const mockInvokeContext = createMock<IInvoke>()

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

      jest.spyOn(service, 'getUserContext').mockReturnValue({
        userId: 'test-user-id',
        tenantCode: 'test-tenant',
        tenantRole: 'admin',
      })

      taskService.listItemsByPk.mockResolvedValue({
        items: mockTasks,
        lastSk: undefined,
      })

      const result = await service.getSfnTaskParentBySettingCode(
        masterSettingCode,
        mockInvokeContext
      )

      expect(result).toHaveLength(1)
      expect(result[0].sk).toBe('MASTER_COPY_TEST_SETTING#PARENT')
    })

    it('should throw BadRequestException when masterSettingCode is empty', async () => {
      await expect(
        service.getSfnTaskParentBySettingCode('', mockInvokeContext)
      ).rejects.toThrow(BadRequestException)

      await expect(
        service.getSfnTaskParentBySettingCode('', mockInvokeContext)
      ).rejects.toThrow('Must provide master setting code')
    })

    it('should throw BadRequestException when masterSettingCode is null', async () => {
      await expect(
        service.getSfnTaskParentBySettingCode(null as any, mockInvokeContext)
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


  describe('getUserContext', () => {
    it('should extract user context from IInvoke', () => {
      const mockInvokeContext = createMock<IInvoke>()
      
      const result = service.getUserContext(mockInvokeContext)

      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
    })
  })
})
