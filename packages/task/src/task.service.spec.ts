import {
  DynamoDbService,
  JwtClaims,
  SnsService,
} from '@mbc-cqrs-serverless/core'
import { Logger } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { TaskService } from '.'
import { ConfigService } from '@nestjs/config'
import { ulid } from 'ulid'
import { TaskEntity } from './entity'
import { TaskStatusEnum } from './enums'

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
            get: jest.fn(),
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
  })
})
