import {
  DynamoDbService,
  JwtClaims,
  SnsService,
} from '@mbc-cqrs-serverless/core'
import { Logger, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { TaskService } from '.'
import { ConfigService } from '@nestjs/config'
import { ulid } from 'ulid'
import { TaskEntity } from './entity'
import { TaskStatusEnum } from './enums'
import { TaskQueueEvent } from './event'
import { StepFunctionTaskEvent } from './event/task.sfn.event'

jest.mock('ulid', () => ({
  ulid: jest.fn().mockReturnValue('mocked-uuid'),
}))

const optionsMock = {
  invokeContext: {
    event: {
      requestContext: {
        accountId: '1',
        http: {
          protocol: 'HTTP/1.1',
          sourceIp: '127.0.0.1',
          userAgent: 'PostmanRuntime/7.28.4',
        },
        requestId: '81bf1821-34b0-4dc5-a2ce-685d37d22f8c',
        authorizer: {
          jwt: {
            claims: {
              'custom:tenant': 'MBC',
              'custom:roles': '[{"tenant":"MBC","role":"admin"}]',
            } as JwtClaims,
          },
        },
      },
    },
    context: {
      awsRequestId: '81bf1821-34b0-4dc5-a2ce-685d37d22f8c',
    },
  },
}

describe('TaskService', () => {
  let service: TaskService
  let dynamoDbService: DynamoDbService
  let snsService: SnsService
  const mockTableName = 'tasks'

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        {
          provide: DynamoDbService,
          useValue: {
            getItem: jest.fn(),
            updateItem: jest.fn(),
            getTableName: jest.fn().mockReturnValue(mockTableName),
            putItem: jest.fn(),
            listItemsByPk: jest.fn(),
          },
        },
        {
          provide: SnsService,
          useValue: {
            publish: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'ALARM_TOPIC_ARN') {
                return 'arn:aws:sns:us-east-1:123456789012:alarm-topic'
              }
              return 'tasks'
            }),
          },
        },
        Logger,
      ],
    }).compile()

    service = module.get<TaskService>(TaskService)
    dynamoDbService = module.get<DynamoDbService>(DynamoDbService)
    snsService = module.get<SnsService>(SnsService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should get table name on initialization', () => {
    expect(dynamoDbService.getTableName).toHaveBeenCalledWith('tasks')
    expect(service['tableName']).toBe(mockTableName)
  })

  describe('createTask', () => {
    it('should create a new task', async () => {
      const dto = {
        tenantCode: 'MBC',
        taskType: 'task-type',
        name: 'task-name',
        input: { foo: 'bar' },
      }

      const result = await service.createTask(dto, optionsMock)
      expect(result).toBeDefined()
      expect(result.pk).toBe(`TASK#${dto.tenantCode}`)
      expect(result.sk).toBe(`${dto.taskType}#mocked-uuid`)
      expect(result.input).toEqual(dto.input)
      expect(dynamoDbService.putItem).toHaveBeenCalledTimes(1)
    })
  })
  describe('createStepFunctionTask', () => {
    it('should create a new step function task', async () => {
      const dto = {
        tenantCode: 'tenant-code',
        taskType: 'task-type',
        name: 'task-name',
        input: { foo: 'bar' },
      }
      const result = await service.createStepFunctionTask(dto, optionsMock)
      expect(result).toBeDefined()
      expect(result.pk).toBe(`SFN_TASK#${dto.tenantCode}`)
      expect(result.sk).toBe(`${dto.taskType}#mocked-uuid`)
      expect(result.input).toEqual(dto.input)
      expect(dynamoDbService.putItem).toHaveBeenCalledTimes(1)
    })
  })
  describe('updateStatus', () => {
    it('should update the status of a task', async () => {
      const key = {
        pk: 'TASK#tenant-code',
        sk: 'task-type#mocked-uuid',
      }
      const status = 'COMPLETED'
      const attributes = { result: 'success' }

      await service.updateStatus(key, status, attributes)
      expect(dynamoDbService.updateItem).toHaveBeenCalledTimes(1)
      expect(snsService.publish).toHaveBeenCalledTimes(1)
    })
  })
  describe('formatTaskStatus', () => {
    it('should format task status correctly', async () => {
      const tasks = [
        {
          pk: 'SFN_TASK#tenant-code',
          sk: 'task-type#mocked-uuid#1',
          status: TaskStatusEnum.COMPLETED,
        },
        {
          pk: 'SFN_TASK#tenant-code',
          sk: 'task-type#mocked-uuid#2',
          status: TaskStatusEnum.FAILED,
        },
        {
          pk: 'SFN_TASK#tenant-code',
          sk: 'task-type#mocked-uuid#3',
          status: TaskStatusEnum.PROCESSING,
        },
      ].map(
        (task) =>
          new TaskEntity({
            ...task,
            tenantCode: 'tenant-code',
            attributes: {},
          }),
      )

      const result = await service.formatTaskStatus(tasks)

      expect(result).toBeDefined()
      expect(result.subTaskCount).toBe(3)
      expect(result.subTaskSucceedCount).toBe(1)
      expect(result.subTaskFailedCount).toBe(1)
      expect(result.subTaskRunningCount).toBe(1)
      expect(result.subTasks).toBeDefined()
      expect(result.subTasks.length).toBe(3)
      expect(result.subTasks[0].pk).toBe(tasks[0].pk)
      expect(result.subTasks[0].sk).toBe(tasks[0].sk)
      expect(result.subTasks[0].status).toBe(tasks[0].status)
    })

    it('should handle empty tasks array', async () => {
      const tasks: any[] = []

      const result = await service.formatTaskStatus(tasks)

      expect(result).toBeDefined()
      expect(result.subTaskCount).toBe(0)
      expect(result.subTaskSucceedCount).toBe(0)
      expect(result.subTaskFailedCount).toBe(0)
      expect(result.subTaskRunningCount).toBe(0)
      expect(result.subTasks).toBeDefined()
      expect(result.subTasks.length).toBe(0)
    })

    it('should handle mixed task statuses', async () => {
      const tasks = [
        {
          pk: 'SFN_TASK#tenant-code',
          sk: 'task-type#mocked-uuid#1',
          status: TaskStatusEnum.COMPLETED,
        },
        {
          pk: 'SFN_TASK#tenant-code',
          sk: 'task-type#mocked-uuid#2',
          status: TaskStatusEnum.COMPLETED,
        },
        {
          pk: 'SFN_TASK#tenant-code',
          sk: 'task-type#mocked-uuid#3',
          status: TaskStatusEnum.FAILED,
        },
        {
          pk: 'SFN_TASK#tenant-code',
          sk: 'task-type#mocked-uuid#4',
          status: TaskStatusEnum.PROCESSING,
        },
        {
          pk: 'SFN_TASK#tenant-code',
          sk: 'task-type#mocked-uuid#5',
          status: TaskStatusEnum.CREATED,
        },
      ].map(
        (task) =>
          new TaskEntity({
            ...task,
            tenantCode: 'tenant-code',
            attributes: {},
          }),
      )

      const result = await service.formatTaskStatus(tasks)

      expect(result.subTaskCount).toBe(5)
      expect(result.subTaskSucceedCount).toBe(2)
      expect(result.subTaskFailedCount).toBe(1)
      expect(result.subTaskRunningCount).toBe(1)
    })
  })

  describe('createSubTask', () => {
    const mockTaskQueueEvent = {
      taskEvent: {
        taskKey: {
          pk: 'SFN_TASK#tenant-code',
          sk: 'task-type#parent-uuid',
        },
        taskEntity: {
          type: 'test-task',
          name: 'Test Task',
          tenantCode: 'tenant-code',
          input: [
            { key: 'value1' },
            { key: 'value2' },
            { key: 'value3' },
          ],
          requestId: 'test-request-id',
          createdBy: 'test-user',
          updatedBy: 'test-user',
          createdIp: '127.0.0.1',
          updatedIp: '127.0.0.1',
        },
      },
    } as unknown as TaskQueueEvent

    it('should create sub tasks successfully', async () => {
      const result = await service.createSubTask(mockTaskQueueEvent)

      expect(result).toHaveLength(3)
      expect(dynamoDbService.putItem).toHaveBeenCalledTimes(3)

      result.forEach((task, index) => {
        expect(task.pk).toBe('SFN_TASK#tenant-code')
        expect(task.sk).toBe(`task-type#parent-uuid#${index}`)
        expect(task.type).toBe('test-task')
        expect(task.name).toBe('Test Task')
        expect(task.tenantCode).toBe('tenant-code')
        expect(task.status).toBe(TaskStatusEnum.CREATED)
        expect(task.input).toEqual({ key: `value${index + 1}` })
      })
    })

    it('should handle empty input array', async () => {
      const emptyEvent = {
        ...mockTaskQueueEvent,
        taskEvent: {
          ...mockTaskQueueEvent.taskEvent,
          taskEntity: {
            ...mockTaskQueueEvent.taskEvent.taskEntity,
            input: [],
          },
        },
      } as unknown as TaskQueueEvent

      const result = await service.createSubTask(emptyEvent)

      expect(result).toHaveLength(0)
      expect(dynamoDbService.putItem).not.toHaveBeenCalled()
    })

    it('should handle DynamoDB putItem failure', async () => {
      const error = new Error('DynamoDB putItem failed')
      ;(dynamoDbService.putItem as jest.Mock).mockRejectedValueOnce(error)

      await expect(service.createSubTask(mockTaskQueueEvent)).rejects.toThrow(
        'DynamoDB putItem failed'
      )
    })

    it('should handle partial failures in Promise.all', async () => {
      const error = new Error('Partial failure')
      ;(dynamoDbService.putItem as jest.Mock)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(undefined)

      await expect(service.createSubTask(mockTaskQueueEvent)).rejects.toThrow(
        'Partial failure'
      )
    })
  })

  describe('getAllSubTask', () => {
    const mockSubTaskKey = {
      pk: 'SFN_TASK#tenant-code',
      sk: 'task-type#parent-uuid#1',
    }

    it('should get all sub tasks successfully', async () => {
      const mockItems = [
        {
          pk: 'SFN_TASK#tenant-code',
          sk: 'task-type#parent-uuid#0',
          status: TaskStatusEnum.COMPLETED,
        },
        {
          pk: 'SFN_TASK#tenant-code',
          sk: 'task-type#parent-uuid#1',
          status: TaskStatusEnum.PROCESSING,
        },
      ]

      ;(dynamoDbService.listItemsByPk as jest.Mock).mockResolvedValue({
        items: mockItems,
        lastSk: undefined,
      })

      const result = await service.getAllSubTask(mockSubTaskKey)

      expect(result).toHaveLength(2)
      expect(dynamoDbService.listItemsByPk).toHaveBeenCalledWith(
        mockTableName,
        'SFN_TASK#tenant-code',
        {
          skExpression: 'begins_with(sk, :typeCode)',
          skAttributeValues: {
            ':typeCode': 'task-type#parent-uuid#',
          },
        },
        undefined
      )

      result.forEach((task, index) => {
        expect(task).toBeInstanceOf(TaskEntity)
        expect(task.pk).toBe(mockItems[index].pk)
        expect(task.sk).toBe(mockItems[index].sk)
      })
    })

    it('should handle pagination correctly', async () => {
      const mockItems1 = [
        {
          pk: 'SFN_TASK#tenant-code',
          sk: 'task-type#parent-uuid#0',
          status: TaskStatusEnum.COMPLETED,
        },
      ]
      const mockItems2 = [
        {
          pk: 'SFN_TASK#tenant-code',
          sk: 'task-type#parent-uuid#1',
          status: TaskStatusEnum.PROCESSING,
        },
      ]

      ;(dynamoDbService.listItemsByPk as jest.Mock)
        .mockResolvedValueOnce({
          items: mockItems1,
          lastSk: 'task-type#parent-uuid#0',
        })
        .mockResolvedValueOnce({
          items: mockItems2,
          lastSk: undefined,
        })

      const result = await service.getAllSubTask(mockSubTaskKey)

      expect(result).toHaveLength(2)
      expect(dynamoDbService.listItemsByPk).toHaveBeenCalledTimes(2)
      expect(dynamoDbService.listItemsByPk).toHaveBeenNthCalledWith(
        1,
        mockTableName,
        'SFN_TASK#tenant-code',
        {
          skExpression: 'begins_with(sk, :typeCode)',
          skAttributeValues: {
            ':typeCode': 'task-type#parent-uuid#',
          },
        },
        undefined
      )
      expect(dynamoDbService.listItemsByPk).toHaveBeenNthCalledWith(
        2,
        mockTableName,
        'SFN_TASK#tenant-code',
        {
          skExpression: 'begins_with(sk, :typeCode)',
          skAttributeValues: {
            ':typeCode': 'task-type#parent-uuid#',
          },
        },
        'task-type#parent-uuid#0'
      )
    })

    it('should handle empty results', async () => {
      ;(dynamoDbService.listItemsByPk as jest.Mock).mockResolvedValue({
        items: [],
        lastSk: undefined,
      })

      const result = await service.getAllSubTask(mockSubTaskKey)

      expect(result).toHaveLength(0)
    })

    it('should handle DynamoDB listItemsByPk failure', async () => {
      const error = new Error('DynamoDB listItemsByPk failed')
      ;(dynamoDbService.listItemsByPk as jest.Mock).mockRejectedValue(error)

      await expect(service.getAllSubTask(mockSubTaskKey)).rejects.toThrow(
        'DynamoDB listItemsByPk failed'
      )
    })

    it('should handle malformed sort key', async () => {
      const malformedKey = {
        pk: 'SFN_TASK#tenant-code',
        sk: 'malformed-sk',
      }

      ;(dynamoDbService.listItemsByPk as jest.Mock).mockResolvedValue({
        items: [],
        lastSk: undefined,
      })

      const result = await service.getAllSubTask(malformedKey)

      expect(result).toHaveLength(0)
      expect(dynamoDbService.listItemsByPk).toHaveBeenCalledWith(
        mockTableName,
        'SFN_TASK#tenant-code',
        {
          skExpression: 'begins_with(sk, :typeCode)',
          skAttributeValues: {
            ':typeCode': '#',
          },
        },
        undefined
      )
    })
  })

  describe('updateStepFunctionTask', () => {
    const mockKey = {
      pk: 'SFN_TASK#tenant-code',
      sk: 'task-type#mocked-uuid',
    }

    it('should update step function task successfully', async () => {
      const attributes = { result: 'success' }
      const status = TaskStatusEnum.COMPLETED
      const notifyId = 'custom-notify-id'

      await service.updateStepFunctionTask(mockKey, attributes, status, notifyId)

      expect(dynamoDbService.updateItem).toHaveBeenCalledWith(
        mockTableName,
        mockKey,
        {
          set: { attributes, status },
        }
      )

      expect(snsService.publish).toHaveBeenCalledWith({
        action: 'task-status',
        pk: mockKey.pk,
        sk: mockKey.sk,
        table: mockTableName,
        id: notifyId,
        tenantCode: 'tenant-code',
        content: { attributes, status },
      })
    })

    it('should use default notify id when not provided', async () => {
      const attributes = { result: 'success' }
      const status = TaskStatusEnum.COMPLETED

      await service.updateStepFunctionTask(mockKey, attributes, status)

      expect(snsService.publish).toHaveBeenCalledWith({
        action: 'task-status',
        pk: mockKey.pk,
        sk: mockKey.sk,
        table: mockTableName,
        id: `${mockKey.pk}#${mockKey.sk}`,
        tenantCode: 'tenant-code',
        content: { attributes, status },
      })
    })

    it('should handle DynamoDB updateItem failure', async () => {
      const error = new Error('DynamoDB updateItem failed')
      ;(dynamoDbService.updateItem as jest.Mock).mockRejectedValue(error)

      await expect(
        service.updateStepFunctionTask(mockKey, {}, TaskStatusEnum.FAILED)
      ).rejects.toThrow('DynamoDB updateItem failed')
    })

    it('should handle SNS publish failure', async () => {
      const error = new Error('SNS publish failed')
      ;(snsService.publish as jest.Mock).mockRejectedValue(error)

      await expect(
        service.updateStepFunctionTask(mockKey, {}, TaskStatusEnum.COMPLETED)
      ).rejects.toThrow('SNS publish failed')
    })
  })

  describe('getTask', () => {
    const mockKey = {
      pk: 'TASK#tenant-code',
      sk: 'task-type#mocked-uuid',
    }

    it('should get task successfully', async () => {
      const mockItem = {
        pk: mockKey.pk,
        sk: mockKey.sk,
        status: TaskStatusEnum.COMPLETED,
        tenantCode: 'tenant-code',
      }

      ;(dynamoDbService.getItem as jest.Mock).mockResolvedValue(mockItem)

      const result = await service.getTask(mockKey)

      expect(result).toBeInstanceOf(TaskEntity)
      expect(result.pk).toBe(mockKey.pk)
      expect(result.sk).toBe(mockKey.sk)
      expect(dynamoDbService.getItem).toHaveBeenCalledWith(mockTableName, mockKey)
    })

    it('should handle DynamoDB getItem failure', async () => {
      const error = new Error('DynamoDB getItem failed')
      ;(dynamoDbService.getItem as jest.Mock).mockRejectedValue(error)

      await expect(service.getTask(mockKey)).rejects.toThrow(
        'DynamoDB getItem failed'
      )
    })

    it('should handle null result from DynamoDB', async () => {
      ;(dynamoDbService.getItem as jest.Mock).mockResolvedValue(null)

      const result = await service.getTask(mockKey)

      expect(result).toBeInstanceOf(TaskEntity)
      expect(result.pk).toBeUndefined()
    })
  })

  describe('updateSubTaskStatus', () => {
    const mockKey = {
      pk: 'SFN_TASK#tenant-code',
      sk: 'task-type#mocked-uuid#1',
    }

    it('should update sub task status successfully', async () => {
      const status = TaskStatusEnum.COMPLETED
      const attributes = { result: 'success' }
      const notifyId = 'custom-notify-id'

      await service.updateSubTaskStatus(mockKey, status, attributes, notifyId)

      expect(dynamoDbService.updateItem).toHaveBeenCalledWith(
        mockTableName,
        mockKey,
        {
          set: { status, attributes },
        }
      )

      expect(snsService.publish).toHaveBeenCalledWith({
        action: 'sub-task-status',
        pk: mockKey.pk,
        sk: mockKey.sk,
        table: mockTableName,
        id: notifyId,
        tenantCode: 'tenant-code',
        content: { status, attributes },
      })
    })

    it('should use default notify id when not provided', async () => {
      const status = TaskStatusEnum.FAILED
      const attributes = { error: 'test error' }

      await service.updateSubTaskStatus(mockKey, status, attributes)

      expect(snsService.publish).toHaveBeenCalledWith({
        action: 'sub-task-status',
        pk: mockKey.pk,
        sk: mockKey.sk,
        table: mockTableName,
        id: `${mockKey.pk}#${mockKey.sk}`,
        tenantCode: 'tenant-code',
        content: { status, attributes },
      })
    })

    it('should handle DynamoDB updateItem failure', async () => {
      const error = new Error('DynamoDB updateItem failed')
      ;(dynamoDbService.updateItem as jest.Mock).mockRejectedValue(error)

      await expect(
        service.updateSubTaskStatus(mockKey, TaskStatusEnum.FAILED)
      ).rejects.toThrow('DynamoDB updateItem failed')
    })

    it('should handle SNS publish failure', async () => {
      const error = new Error('SNS publish failed')
      ;(snsService.publish as jest.Mock).mockRejectedValue(error)

      await expect(
        service.updateSubTaskStatus(mockKey, TaskStatusEnum.COMPLETED)
      ).rejects.toThrow('SNS publish failed')
    })
  })

  describe('listItemsByPk', () => {
    it('should list TASK items successfully', async () => {
      const mockItems = [
        {
          pk: 'TASK#tenant-code',
          sk: 'task-type#uuid1',
          status: TaskStatusEnum.COMPLETED,
        },
        {
          pk: 'TASK#tenant-code',
          sk: 'task-type#uuid2',
          status: TaskStatusEnum.PROCESSING,
        },
      ]

      ;(dynamoDbService.listItemsByPk as jest.Mock).mockResolvedValue({
        items: mockItems,
        lastSk: 'task-type#uuid2',
      })

      const result = await service.listItemsByPk('tenant-code', 'TASK')

      expect(result.items).toHaveLength(2)
      expect(result.lastSk).toBe('task-type#uuid2')
      expect(dynamoDbService.listItemsByPk).toHaveBeenCalledWith(
        mockTableName,
        'TASK#tenant-code',
        undefined,
        undefined,
        undefined,
        undefined
      )

      result.items.forEach((item, index) => {
        expect(item).toBeInstanceOf(TaskEntity)
        expect(item.pk).toBe(mockItems[index].pk)
        expect(item.sk).toBe(mockItems[index].sk)
      })
    })

    it('should list SFN_TASK items successfully', async () => {
      const mockItems = [
        {
          pk: 'SFN_TASK#tenant-code',
          sk: 'task-type#uuid1',
          status: TaskStatusEnum.COMPLETED,
        },
      ]

      ;(dynamoDbService.listItemsByPk as jest.Mock).mockResolvedValue({
        items: mockItems,
        lastSk: undefined,
      })

      const result = await service.listItemsByPk('tenant-code', 'SFN_TASK')

      expect(result.items).toHaveLength(1)
      expect(result.lastSk).toBeUndefined()
      expect(dynamoDbService.listItemsByPk).toHaveBeenCalledWith(
        mockTableName,
        'SFN_TASK#tenant-code',
        undefined,
        undefined,
        undefined,
        undefined
      )
    })

    it('should handle options parameters correctly', async () => {
      const options = {
        sk: {
          skExpression: 'begins_with(sk, :prefix)',
          skAttributeValues: { ':prefix': 'task-type' },
          skAttributeNames: { '#status': 'status' },
        },
        startFromSk: 'task-type#start',
        limit: 10,
        order: 'desc' as const,
      }

      ;(dynamoDbService.listItemsByPk as jest.Mock).mockResolvedValue({
        items: [],
        lastSk: undefined,
      })

      await service.listItemsByPk('tenant-code', 'TASK', options)

      expect(dynamoDbService.listItemsByPk).toHaveBeenCalledWith(
        mockTableName,
        'TASK#tenant-code',
        options.sk,
        options.startFromSk,
        options.limit,
        options.order
      )
    })

    it('should throw NotFoundException for invalid task type', async () => {
      await expect(
        service.listItemsByPk('tenant-code', 'INVALID_TYPE')
      ).rejects.toThrow(NotFoundException)

      await expect(
        service.listItemsByPk('tenant-code', 'INVALID_TYPE')
      ).rejects.toThrow(
        'The type of task, must be either "TASK" or "SFN_TASK"'
      )
    })

    it('should throw NotFoundException for undefined task type', async () => {
      await expect(
        service.listItemsByPk('tenant-code', undefined)
      ).rejects.toThrow(NotFoundException)
    })

    it('should handle DynamoDB listItemsByPk failure', async () => {
      const error = new Error('DynamoDB listItemsByPk failed')
      ;(dynamoDbService.listItemsByPk as jest.Mock).mockRejectedValue(error)

      await expect(
        service.listItemsByPk('tenant-code', 'TASK')
      ).rejects.toThrow('DynamoDB listItemsByPk failed')
    })
  })

  describe('publishAlarm', () => {
    const mockTaskQueueEvent = Object.create(TaskQueueEvent.prototype)
    Object.assign(mockTaskQueueEvent, {
      body: JSON.stringify({
        dynamodb: {
          Keys: {
            pk: { S: 'SFN_TASK#tenant-code' },
            sk: { S: 'task-type#mocked-uuid' },
          },
        },
      }),
      _taskEvent: {
        taskKey: {
          pk: 'SFN_TASK#tenant-code',
          sk: 'task-type#mocked-uuid',
        },
      },
    })

    const mockStepFunctionTaskEvent = {
      input: {
        pk: 'SFN_TASK#tenant-code',
        sk: 'task-type#mocked-uuid',
      },
      taskKey: {
        pk: 'SFN_TASK#tenant-code',
        sk: 'task-type#mocked-uuid',
      },
    } as unknown as StepFunctionTaskEvent

    beforeEach(() => {
      ;(service as any).alarmTopicArn = 'arn:aws:sns:region:account:alarm-topic'
    })

    it('should publish alarm for TaskQueueEvent', async () => {
      const errorDetails = { message: 'Task execution failed', code: 'EXEC_ERROR' }

      await service.publishAlarm(mockTaskQueueEvent, errorDetails)

      expect(snsService.publish).toHaveBeenCalledWith(
        {
          action: 'sfn-alarm',
          id: 'SFN_TASK#tenant-code#task-type#mocked-uuid',
          table: mockTableName,
          pk: 'SFN_TASK#tenant-code',
          sk: 'task-type#mocked-uuid',
          tenantCode: 'tenant-code',
          content: {
            errorMessage: errorDetails,
          },
        },
        'arn:aws:sns:region:account:alarm-topic'
      )
    })

    it('should publish alarm for StepFunctionTaskEvent', async () => {
      const errorDetails = { message: 'Step function failed', code: 'SFN_ERROR' }

      await service.publishAlarm(mockStepFunctionTaskEvent, errorDetails)

      expect(snsService.publish).toHaveBeenCalledWith(
        {
          action: 'sfn-alarm',
          id: 'SFN_TASK#tenant-code#task-type#mocked-uuid',
          table: mockTableName,
          pk: 'SFN_TASK#tenant-code',
          sk: 'task-type#mocked-uuid',
          tenantCode: 'tenant-code',
          content: {
            errorMessage: errorDetails,
          },
        },
        'arn:aws:sns:region:account:alarm-topic'
      )
    })

    it('should handle string error details', async () => {
      const errorDetails = 'Simple error message'

      await service.publishAlarm(mockTaskQueueEvent, errorDetails)

      expect(snsService.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          content: {
            errorMessage: errorDetails,
          },
        }),
        'arn:aws:sns:region:account:alarm-topic'
      )
    })

    it('should handle SNS publish failure', async () => {
      const error = new Error('SNS publish failed')
      ;(snsService.publish as jest.Mock).mockRejectedValue(error)

      await expect(
        service.publishAlarm(mockTaskQueueEvent, { error: 'test' })
      ).rejects.toThrow('SNS publish failed')
    })

    it('should extract tenant code correctly from different pk formats', async () => {
      const eventWithDifferentPk = Object.create(TaskQueueEvent.prototype)
      Object.assign(eventWithDifferentPk, {
        body: JSON.stringify({
          dynamodb: {
            Keys: {
              pk: { S: 'SFN_TASK#different-tenant' },
              sk: { S: 'task-type#mocked-uuid' },
            },
          },
        }),
        _taskEvent: {
          taskKey: {
            pk: 'SFN_TASK#different-tenant',
            sk: 'task-type#mocked-uuid',
          },
        },
      })

      await service.publishAlarm(eventWithDifferentPk, { error: 'test' })

      expect(snsService.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantCode: 'different-tenant',
        }),
        'arn:aws:sns:region:account:alarm-topic'
      )
    })
  })

  describe('Error Handling - DynamoDB Operations', () => {
    it('should handle createTask DynamoDB failure', async () => {
      const dto = {
        tenantCode: 'MBC',
        taskType: 'task-type',
        name: 'task-name',
        input: { foo: 'bar' },
      }

      const error = new Error('DynamoDB putItem failed')
      ;(dynamoDbService.putItem as jest.Mock).mockRejectedValue(error)

      await expect(service.createTask(dto, optionsMock)).rejects.toThrow(
        'DynamoDB putItem failed'
      )
    })

    it('should handle createStepFunctionTask DynamoDB failure', async () => {
      const dto = {
        tenantCode: 'tenant-code',
        taskType: 'task-type',
        name: 'task-name',
        input: { foo: 'bar' },
      }

      const error = new Error('DynamoDB putItem failed')
      ;(dynamoDbService.putItem as jest.Mock).mockRejectedValue(error)

      await expect(service.createStepFunctionTask(dto, optionsMock)).rejects.toThrow(
        'DynamoDB putItem failed'
      )
    })

    it('should handle updateStatus DynamoDB failure', async () => {
      const key = {
        pk: 'TASK#tenant-code',
        sk: 'task-type#mocked-uuid',
      }

      const error = new Error('DynamoDB updateItem failed')
      ;(dynamoDbService.updateItem as jest.Mock).mockRejectedValue(error)

      await expect(
        service.updateStatus(key, TaskStatusEnum.COMPLETED)
      ).rejects.toThrow('DynamoDB updateItem failed')
    })
  })

  describe('Error Handling - SNS Operations', () => {
    it('should handle updateStatus SNS failure', async () => {
      const key = {
        pk: 'TASK#tenant-code',
        sk: 'task-type#mocked-uuid',
      }

      const error = new Error('SNS publish failed')
      ;(snsService.publish as jest.Mock).mockRejectedValue(error)

      await expect(
        service.updateStatus(key, TaskStatusEnum.COMPLETED)
      ).rejects.toThrow('SNS publish failed')
    })

    it('should handle concurrent SNS failures', async () => {
      const key1 = {
        pk: 'TASK#tenant-code',
        sk: 'task-type#uuid1',
      }
      const key2 = {
        pk: 'TASK#tenant-code',
        sk: 'task-type#uuid2',
      }

      const error = new Error('SNS publish failed')
      ;(snsService.publish as jest.Mock).mockRejectedValue(error)

      await expect(
        Promise.all([
          service.updateStatus(key1, TaskStatusEnum.COMPLETED),
          service.updateStatus(key2, TaskStatusEnum.FAILED),
        ])
      ).rejects.toThrow('SNS publish failed')
    })
  })

  describe('Edge Cases and Input Validation', () => {
    it('should handle missing invokeContext properties in createTask', async () => {
      const dto = {
        tenantCode: 'MBC',
        taskType: 'task-type',
        name: 'task-name',
        input: { foo: 'bar' },
      }

      const minimalOptions = {
        invokeContext: {
          event: {},
          context: {},
        },
      }

      const result = await service.createTask(dto, minimalOptions as any)

      expect(result).toBeDefined()
      expect(result.createdIp).toBeUndefined()
      expect(result.requestId).toBeUndefined()
    })

    it('should handle missing name in createTask', async () => {
      const dto = {
        tenantCode: 'MBC',
        taskType: 'task-type',
        input: { foo: 'bar' },
      }

      const result = await service.createTask(dto, optionsMock)

      expect(result.name).toBe('task-type')
    })

    it('should handle large input arrays in createSubTask', async () => {
      const largeInputArray = Array.from({ length: 100 }, (_, i) => ({
        key: `value${i}`,
      }))

      const mockTaskQueueEvent = {
        taskEvent: {
          taskKey: {
            pk: 'SFN_TASK#tenant-code',
            sk: 'task-type#parent-uuid',
          },
          taskEntity: {
            type: 'test-task',
            name: 'Test Task',
            tenantCode: 'tenant-code',
            input: largeInputArray,
            requestId: 'test-request-id',
            createdBy: 'test-user',
            updatedBy: 'test-user',
            createdIp: '127.0.0.1',
            updatedIp: '127.0.0.1',
          },
        },
      } as unknown as TaskQueueEvent

      const result = await service.createSubTask(mockTaskQueueEvent)

      expect(result).toHaveLength(100)
      expect(dynamoDbService.putItem).toHaveBeenCalledTimes(100)
    })

    it('should handle malformed tenant code extraction in publishAlarm', async () => {
      const eventWithMalformedPk = Object.create(TaskQueueEvent.prototype)
      Object.assign(eventWithMalformedPk, {
        body: JSON.stringify({
          dynamodb: {
            Keys: {
              pk: { S: 'MALFORMED_PK' },
              sk: { S: 'task-type#mocked-uuid' },
            },
          },
        }),
        _taskEvent: {
          taskKey: {
            pk: 'MALFORMED_PK',
            sk: 'task-type#mocked-uuid',
          },
        },
      })

      await service.publishAlarm(eventWithMalformedPk, { error: 'test' })

      expect(snsService.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantCode: 'MALFORMED_PK',
        }),
        expect.any(String)
      )
    })
  })
})
